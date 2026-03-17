import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import os from "os";
import { v4 as uuid } from "uuid";
import { sendToPython } from "../services/pythonBridge.js";

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
    const allowed = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedMimes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];
    if (allowed.includes(ext) && allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}`));
    }
  },
});

interface Session {
  id: string;
  filePath: string;
  filename: string;
  createdAt: number;
  processing: boolean;
  result?: {
    result_png: string;
    result_web_png: string;
    overlay_png: string;
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

function validateParams(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const p = raw as Record<string, unknown>;
  const clamp = (v: unknown, min: number, max: number, def: number) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return def;
    return Math.max(min, Math.min(max, n));
  };
  return {
    edge_sensitivity: clamp(p.edge_sensitivity, 0, 1, 0.5),
    contour_threshold: clamp(p.contour_threshold, 0, 1, 0.5),
    crop_padding: Math.round(clamp(p.crop_padding, 0, 100, 0)),
    top_edge_cleanup: clamp(p.top_edge_cleanup, 0, 1, 0.7),
    corner_radius: clamp(p.corner_radius, 0, 1, 0.5),
    rotate_correction: p.rotate_correction !== false && p.rotate_correction !== "false",
  };
}

router.post(
  "/upload",
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

router.post("/process", async (req: Request, res: Response) => {
  const { sessionId, params } = req.body;

  if (!sessionId || typeof sessionId !== "string" || !sessions.has(sessionId)) {
    res.status(400).json({ error: "Invalid session" });
    return;
  }

  const session = sessions.get(sessionId)!;

  if (session.processing) {
    res.status(409).json({ error: "Processing already in progress" });
    return;
  }

  const validatedParams = validateParams(params);
  session.processing = true;

  try {
    const result = await sendToPython(
      session.filePath,
      session.filename,
      validatedParams
    );

    if (result.error) {
      res.json({
        error: result.error,
        candidates_found: result.candidates_found || 0,
      });
      return;
    }

    session.result = result;

    res.json({
      result_web_png: result.result_web_png,
      overlay_png: result.overlay_png,
      metadata: result.metadata,
    });
  } catch (err: unknown) {
    console.error("Processing error:", err);
    res.status(500).json({ error: "Processing failed. Please try again." });
  } finally {
    session.processing = false;
  }
});

router.get("/export/:sessionId", (req: Request, res: Response) => {
  const session = sessions.get(req.params.sessionId);

  if (!session?.result) {
    res.status(404).json({ error: "No result available" });
    return;
  }

  const size = req.query.size === "web" ? "result_web_png" : "result_png";
  const base64Data = session.result[size as "result_png" | "result_web_png"];

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

router.delete("/session/:sessionId", (req: Request, res: Response) => {
  const session = sessions.get(req.params.sessionId);
  if (session) {
    fs.unlink(session.filePath, () => {});
    sessions.delete(req.params.sessionId);
  }
  res.json({ ok: true });
});

export { router as processRoutes };
