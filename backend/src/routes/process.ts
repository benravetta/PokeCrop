import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import os from "os";
import { v4 as uuid } from "uuid";
import crypto from "crypto";
import { sendToPython } from "../services/pythonBridge.js";
import { requireAuth } from "../middleware/auth.js";
import { validateParams } from "../lib/cropParams.js";
import {
  FREE_DAILY_LIMIT,
  getPlan,
  getUsageToday,
  incrementUsage,
  type Plan,
} from "../lib/usage.js";
import { logActivity } from "../lib/activity.js";
import { logUsageEventAwait } from "../lib/usageEvents.js";
import { archiveCropAsync, pngDimensions } from "../lib/catalog.js";
import {
  ADMIN_EFFECTIVE_PLAN,
  isAdminRole,
} from "../lib/adminAccess.js";
import { assessCard, CardAssessment } from "../lib/cardVision.js";
import { runCropJob } from "../lib/cropPipeline.js";

const router = Router();

const tmpDir = path.join(os.tmpdir(), "pokecrop");
fs.mkdirSync(tmpDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, tmpDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuid()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".webp", ".pdf", ".heic", ".heif", ".dng"];
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedMimes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
      "image/heic",
      "image/heif",
      "image/x-adobe-dng",
      "image/dng",
    ];
    // Browsers often send HEIC with an empty/generic mimetype; trust the
    // extension when the mimetype is unhelpful.
    const genericMime = !file.mimetype || file.mimetype === "application/octet-stream";
    if (allowed.includes(ext) && (allowedMimes.includes(file.mimetype) || genericMime)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}`));
    }
  },
});

interface Session {
  id: string;
  userId: string;
  filePath: string;
  filename: string;
  createdAt: number;
  processing: boolean;
  // True once a successful extraction has been metered against the user's daily
  // quota, so re-processing the same upload (crop tweaks) does not double-count.
  counted?: boolean;
  // Params from the most recent /process, reused to regenerate the full-res
  // PNG lazily at export time (it is not produced during the interactive loop).
  lastParams?: Record<string, unknown>;
  // True once this upload's crop has been archived to the catalog, so it's
  // catalogued at most once (one R2 object + one paid identify call) per upload.
  archived?: boolean;
  historyEventId?: number | null;
  // GPT-4o-mini pre-crop assessment, computed at most once per upload and reused
  // across re-processing so we never pay for it more than once per photo.
  assessment?: CardAssessment | null;
  assessed?: boolean;
  result?: {
    result_web_png: string;
    // Full-resolution PNG: produced lazily on the first original-size export
    // and cached thereafter.
    result_png?: string;
    // Small downscaled JPEG used for cheap AI identification at archive time.
    idImageJpeg?: string;
    metadata: Record<string, unknown>;
  };
}

const MAX_SESSIONS = 50;
const SESSION_TTL_MS = 30 * 60 * 1000;
const sessions = new Map<string, Session>();

const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      fs.unlink(session.filePath, (err) => {
        if (err && err.code !== "ENOENT")
          console.error("Cleanup failed:", err.message);
      });
      sessions.delete(id);
    }
  }
}, 60_000);

process.on("SIGINT", () => clearInterval(cleanupInterval));
process.on("SIGTERM", () => clearInterval(cleanupInterval));

function sanitizeFilename(name: string): string {
  const base = path.basename(name, path.extname(name));
  return base.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100);
}

// Archive this upload's crop to the R2 catalog exactly once. Builds the
// full-resolution PNG (and a small id image for AI identification) lazily if it
// hasn't been produced yet. No-op when R2 is unconfigured (inside archiveCrop).
async function ensureArchived(session: Session): Promise<void> {
  if (session.archived || !session.result) return;
  session.archived = true; // claim it up-front so concurrent calls don't double-render

  try {
    if (!session.result.result_png) {
      const full = await sendToPython(session.filePath, session.filename, {
        ...(session.lastParams ?? {}),
        full_resolution: true,
        identify: true,
      });
      if (full.error || !full.result_png) {
        session.archived = false; // allow a later retry (e.g. on export)
        return;
      }
      session.result.result_png = full.result_png;
      session.result.idImageJpeg = full.id_image_jpeg as string | undefined;
      if (full.metadata) session.result.metadata = full.metadata;
    }

    if (!session.result.result_png) {
      session.archived = false;
      return;
    }
    const buf = Buffer.from(session.result.result_png, "base64");
    const dims = pngDimensions(buf);
    const idB64 = session.result.idImageJpeg;
    const meta = session.result.metadata ?? {};
    archiveCropAsync({
      png: buf,
      idImage: idB64 ? Buffer.from(idB64, "base64") : undefined,
      source: "web",
      width: dims?.width,
      height: dims?.height,
      pipelineConfidence:
        typeof meta.confidence === "number" ? meta.confidence : null,
      metadata: {
        confidence: meta.confidence,
        rotation_deg: meta.rotation_deg,
        needs_manual: meta.needs_manual,
      },
    });
  } catch (err) {
    console.error("ensureArchived failed:", err);
    session.archived = false;
  }
}

// Resolve a session that belongs to the authenticated user. Returns null (and
// nothing else) when the session is missing or owned by someone else — callers
// respond with 404 so a session id can't be probed across accounts.
function getOwnedSession(req: Request, sessionId: string): Session | null {
  const session = sessions.get(sessionId);
  if (!session || session.userId !== req.user?.id) return null;
  return session;
}

router.post(
  "/upload",
  requireAuth,
  upload.single("file"),
  async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    if (sessions.size >= MAX_SESSIONS) {
      fs.unlink(req.file.path, () => {});
      res.status(503).json({ error: "Server busy. Try again shortly." });
      return;
    }

    const sessionId = uuid();
    sessions.set(sessionId, {
      id: sessionId,
      userId: req.user!.id,
      filePath: req.file.path,
      filename: req.file.originalname,
      createdAt: Date.now(),
      processing: false,
    });

    try {
      const fileBuffer = await fs.promises.readFile(req.file.path);
      const base64 = fileBuffer.toString("base64");

      res.json({
        sessionId,
        filename: req.file.originalname,
        originalBase64: base64,
      });
    } catch (err) {
      console.error("Upload read error:", err);
      res.status(500).json({ error: "Failed to read uploaded file" });
    }
  }
);

router.post("/process", requireAuth, async (req: Request, res: Response) => {
  const { sessionId, params } = req.body;

  if (!sessionId || typeof sessionId !== "string") {
    res.status(400).json({ error: "Invalid session" });
    return;
  }

  const session = getOwnedSession(req, sessionId);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  if (session.processing) {
    res.status(409).json({ error: "Processing already in progress" });
    return;
  }

  const userId = req.user!.id;
  const admin = isAdminRole(req.user!.role);

  // This crop only counts against the quota the first time a given upload is
  // successfully extracted; re-processing (crop tweaks, slider changes) is free.
  const willCount = !session.counted;
  let plan: Plan = admin ? ADMIN_EFFECTIVE_PLAN : "free";

  if (willCount && !admin) {
    try {
      plan = await getPlan(userId);
      if (plan === "free") {
        const used = await getUsageToday(userId);
        if (used >= FREE_DAILY_LIMIT) {
          res.status(402).json({
            error: `You've used all ${FREE_DAILY_LIMIT} free crops today. Upgrade for unlimited crops.`,
            reason: "limit",
            plan,
            remaining: 0,
            limit: FREE_DAILY_LIMIT,
          });
          return;
        }
      }
    } catch (err) {
      console.error("Quota check failed:", err);
      res.status(503).json({ error: "Could not verify your plan. Try again shortly." });
      return;
    }
  }

  const validatedParams = validateParams(params);
  session.processing = true;

  try {
    if (!session.assessed) {
      session.assessed = true;
      session.assessment = await assessCard(session.filePath, userId).catch(() => null);
    }
    const assessment = session.assessment ?? null;

    const crop = await runCropJob({
      filePath: session.filePath,
      filename: session.filename,
      params: validatedParams,
      userId,
      fullResolution: false,
      identify: false,
      includeSuitability: false,
      cachedAssessment: assessment,
      metadataLevel: "full",
    });

    if (!crop.ok) {
      res.json({
        error: crop.error,
        candidates_found: crop.candidatesFound ?? 0,
        suitability: assessment ?? undefined,
      });
      return;
    }

    session.lastParams = validatedParams;
    session.result = {
      result_web_png: crop.resultWebPng ?? crop.pngBase64,
      metadata: crop.metadata,
    };

    const result = {
      result_web_png: crop.resultWebPng ?? crop.pngBase64,
      edit_image_jpeg: crop.editImageJpeg,
      metadata: crop.metadata,
    };

    // Meter the successful crop exactly once per upload.
    if (willCount) {
      let cropCount: number | null = null;
      try {
        cropCount = await incrementUsage(userId);
        session.counted = true;
      } catch (err) {
        console.error("Usage increment failed:", err);
      }
      const safeName = sanitizeFilename(session.filename);
      const webBuf = Buffer.from(session.result!.result_web_png, "base64");
      const contentHash = crypto.createHash("sha256").update(webBuf).digest("hex");
      const dims = pngDimensions(webBuf);
      const meta = crop.metadata ?? {};

      logActivity({
        userId,
        action: "crop.web",
        actorId: userId,
        actorEmail: req.user!.email ?? null,
        detail: { filename: safeName },
      });

      const historyEventId = await logUsageEventAwait({
        userId,
        kind: "crop",
        source: "web",
        billing: admin ? "admin" : plan === "free" ? "free" : "subscription",
        plan,
        window: admin ? null : plan === "free" ? "day" : null,
        usedAfter: admin ? null : plan === "free" ? cropCount : null,
        remainingAfter: admin
          ? null
          : plan === "free" && cropCount != null
            ? Math.max(0, FREE_DAILY_LIMIT - cropCount)
            : null,
        summary: safeName,
        detail: {
          filename: safeName,
          content_hash: contentHash,
          pipeline_confidence:
            typeof meta.confidence === "number" ? meta.confidence : null,
          width: dims?.width ?? null,
          height: dims?.height ?? null,
          rotation_deg: meta.rotation_deg,
          needs_manual: meta.needs_manual,
        },
      });
      if (historyEventId) session.historyEventId = historyEventId;

      void ensureArchived(session);
    }

    res.json({
      result_web_png: result.result_web_png,
      edit_image_jpeg: result.edit_image_jpeg,
      metadata: result.metadata,
      historyEventId: session.historyEventId ?? null,
    });
  } catch (err: unknown) {
    console.error("Processing error:", err);
    res.status(500).json({ error: "Processing failed. Please try again." });
  } finally {
    session.processing = false;
  }
});

router.get("/export/:sessionId", requireAuth, async (req: Request, res: Response) => {
  const session = getOwnedSession(req, req.params.sessionId);

  if (!session?.result) {
    res.status(404).json({ error: "No result available" });
    return;
  }

  let base64Data: string | undefined;

  if (req.query.size === "web") {
    base64Data = session.result.result_web_png;
  } else {
    // Original size: build the full-resolution PNG lazily (and cache it) since
    // /process intentionally skips that expensive encode.
    if (!session.result.result_png) {
      try {
        const full = await sendToPython(session.filePath, session.filename, {
          ...(session.lastParams ?? {}),
          full_resolution: true,
          identify: true,
        });
        if (full.error || !full.result_png) {
          res.status(500).json({ error: "Failed to render full-resolution image" });
          return;
        }
        session.result.result_png = full.result_png;
        session.result.idImageJpeg = full.id_image_jpeg as string | undefined;
        if (full.metadata) session.result.metadata = full.metadata;
      } catch (err) {
        console.error("Export render error:", err);
        res.status(500).json({ error: "Failed to render full-resolution image" });
        return;
      }
    }
    base64Data = session.result.result_png;

    // Catalogue the crop (once per upload, de-duplicated by content hash, no-op
    // when R2 is unconfigured). Fire-and-forget so the download isn't delayed.
    void ensureArchived(session);
  }

  if (!base64Data) {
    res.status(404).json({ error: "Result not found" });
    return;
  }

  const buffer = Buffer.from(base64Data, "base64");
  const safeName = sanitizeFilename(session.filename);

  res.set({
    "Content-Type": "image/png",
    "Content-Disposition": `attachment; filename="${safeName}_cropped.png"`,
    "Content-Length": buffer.length.toString(),
  });
  res.send(buffer);
});

router.delete("/session/:sessionId", requireAuth, (req: Request, res: Response) => {
  const session = getOwnedSession(req, req.params.sessionId);
  if (session) {
    fs.unlink(session.filePath, () => {});
    sessions.delete(req.params.sessionId);
  }
  res.json({ ok: true });
});

export { router as processRoutes };
