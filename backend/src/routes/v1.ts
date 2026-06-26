import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import os from "os";
import { v4 as uuid } from "uuid";
import { requireApiKey } from "../middleware/apiKey.js";
import { validateParams } from "../lib/cropParams.js";
import { sendApiError } from "../lib/apiError.js";
import { incrementApiUsage, getApiUsageTodayForUser, countActiveApiKeys } from "../lib/apiKeys.js";
import { logActivity } from "../lib/activity.js";
import { getHistory, logUsageEvent, type UsageKind } from "../lib/usageEvents.js";
import crypto from "crypto";
import { archiveCropAsync } from "../lib/catalog.js";
import { peekRateLimit, consumeRateLimit, rateLimitHeaders, DAILY_SOFT_CAP } from "../lib/rateLimit.js";
import { validateGradeFileMap, validateMulterFile } from "../lib/uploadValidation.js";
import { apiRateLimitPeek } from "../middleware/apiRateLimit.js";
import {
  consumeApiActionRateLimitSlot,
  consumeApiRateLimit,
} from "../lib/accountRateLimit.js";
import { openApiSpec, API_SPEC_VERSION } from "../openapi.js";
import {
  ALLOWED_EXT,
  ALLOWED_MIME,
  resolveImageInput,
  unlinkTemp,
} from "../lib/imageInput.js";
import { runCropJob, type MetadataLevel } from "../lib/cropPipeline.js";
import { getPlan } from "../lib/usage.js";
import { applyCropWatermark, shouldWatermarkCrop } from "../lib/cropWatermark.js";
import {
  executeGrade,
  parseCentering,
  straightenGradeImage,
  type FileMap,
} from "../lib/gradeService.js";
import { previewCentering } from "../lib/centeringPreview.js";
import { getGradeQuota } from "../lib/gradeQuota.js";
import {
  claimGradeIdempotency,
  completeGradeIdempotency,
  releaseGradeIdempotency,
} from "../lib/gradeIdempotency.js";
import { normalizeIdempotencyKey } from "../lib/apiIdempotency.js";
import { buildGradeReportPdfBuffer } from "../lib/gradeReportPdf.js";
import { RemoteFetchError, MAX_REMOTE_BYTES } from "../lib/ssrf.js";

export const API_VERSION = "v1";

const router = Router();

const tmpDir = path.join(os.tmpdir(), "cardcrop-api");
fs.mkdirSync(tmpDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, tmpDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${uuid()}${ext || ".bin"}`);
    },
  }),
  limits: { fileSize: MAX_REMOTE_BYTES },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const genericMime = !file.mimetype || file.mimetype === "application/octet-stream";
    if (ALLOWED_EXT.includes(ext) && (ALLOWED_MIME.includes(file.mimetype) || genericMime)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext || file.mimetype}`));
    }
  },
});

const gradeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_REMOTE_BYTES, files: 10 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const genericMime = !file.mimetype || file.mimetype === "application/octet-stream";
    const gradeExt = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".dng"];
    const gradeMime = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
      "image/x-adobe-dng",
      "image/dng",
    ];
    if (gradeMime.includes(file.mimetype) || (gradeExt.includes(ext) && genericMime)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type"));
    }
  },
}).fields([
  { name: "front", maxCount: 1 },
  { name: "back", maxCount: 1 },
  { name: "angled_front", maxCount: 1 },
  { name: "angled_back", maxCount: 1 },
  { name: "closeups", maxCount: 6 },
]);

function parseParams(raw: unknown): Record<string, unknown> {
  if (typeof raw === "string") {
    try {
      return validateParams(JSON.parse(raw));
    } catch {
      return validateParams({});
    }
  }
  return validateParams(raw);
}

function parseCropOptions(body: Record<string, unknown>): {
  metadataLevel: MetadataLevel;
  includeSuitability: boolean;
} {
  const metadataLevel: MetadataLevel = body.metadata_level === "minimal" ? "minimal" : "full";
  const includeSuitability =
    body.include_suitability !== false && body.include_suitability !== "false";
  return { metadataLevel, includeSuitability };
}

function rateLimitCrop(req: Request, res: Response, next: () => void): void {
  void (async () => {
    try {
      const limit = await peekRateLimit(req.apiUser!.userId, "crop");
      res.set(rateLimitHeaders(limit));
      if (!limit.allowed) {
        sendApiError(
          res,
          "rate_limited",
          limit.message ?? "Rate limit exceeded. Slow down.",
          { "Retry-After": String(limit.retryAfterSec) }
        );
        return;
      }
      next();
    } catch (err) {
      console.error("v1 crop rate limit error:", err);
      sendApiError(res, "internal_error", "Service temporarily unavailable.");
    }
  })();
}

function rateLimitStraighten(req: Request, res: Response, next: () => void): void {
  void (async () => {
    try {
      const limit = await peekRateLimit(req.apiUser!.userId, "straighten");
      res.set(rateLimitHeaders(limit));
      if (!limit.allowed) {
        sendApiError(
          res,
          "rate_limited",
          limit.message ?? "Rate limit exceeded. Slow down.",
          { "Retry-After": String(limit.retryAfterSec) }
        );
        return;
      }
      next();
    } catch (err) {
      console.error("v1 straighten rate limit error:", err);
      sendApiError(res, "internal_error", "Service temporarily unavailable.");
    }
  })();
}

function mapGradeError(res: Response, out: Extract<Awaited<ReturnType<typeof executeGrade>>, { ok: false }>): void {
  const extra: Record<string, unknown> = {};
  if (out.quota) extra.quota = out.quota;
  if (out.capture_quality) extra.capture_quality = out.capture_quality;
  sendApiError(res, out.code, out.message, undefined, extra);
}

type GradeResponseBody = {
  result: Record<string, unknown>;
  quota: unknown;
  capture_quality: unknown;
};

function wantsGradePdf(req: Request): boolean {
  if (req.query.format === "pdf") return true;
  const body = (req.body ?? {}) as Record<string, unknown>;
  if (body.format === "pdf") return true;
  const accept = req.headers.accept || "";
  if (accept.includes("application/pdf")) {
    return !accept.includes("application/json");
  }
  return false;
}

function reportImagesFromFiles(files: FileMap | undefined) {
  return {
    front: files?.front?.[0]?.buffer,
    back: files?.back?.[0]?.buffer,
    frontName: files?.front?.[0]?.originalname,
    backName: files?.back?.[0]?.originalname,
  };
}

async function respondGrade(
  req: Request,
  res: Response,
  body: GradeResponseBody
): Promise<void> {
  if (!wantsGradePdf(req)) {
    res.json(body);
    return;
  }
  const imgs = reportImagesFromFiles(req.files as FileMap | undefined);
  if (!imgs.front) {
    sendApiError(
      res,
      "invalid_request",
      "Front image is required to generate a PDF report (include multipart front, or use JSON Accept)."
    );
    return;
  }
  try {
    const pdf = await buildGradeReportPdfBuffer(body.result, imgs);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${pdf.filename}"`,
      "Content-Length": String(pdf.buffer.length),
    });
    res.send(pdf.buffer);
  } catch (err) {
    console.error("grade PDF build failed:", err);
    sendApiError(res, "processing_failed", "Failed to build grade PDF report.");
  }
}

// POST /v1/crop
router.post(
  "/crop",
  requireApiKey,
  rateLimitCrop,
  upload.single("image"),
  async (req: Request, res: Response) => {
    let tempPath: string | null = null;
    let ownTemp = false;

    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const resolved = await resolveImageInput({
        file: req.file,
        imageUrl: typeof body.image_url === "string" ? body.image_url : undefined,
        imageBase64: typeof body.image_base64 === "string" ? body.image_base64 : undefined,
        tmpDir,
      });

      if ("error" in resolved) {
        sendApiError(res, resolved.code, resolved.error);
        return;
      }

      tempPath = resolved.tempPath;
      ownTemp = resolved.ownTemp;
      const { metadataLevel, includeSuitability } = parseCropOptions(body);
      const params = parseParams(body.params);

      const crop = await runCropJob({
        filePath: tempPath,
        filename: resolved.filename,
        params,
        userId: req.apiUser!.userId,
        fullResolution: true,
        identify: true,
        includeSuitability,
        metadataLevel,
      });

      if (!crop.ok) {
        const extra: Record<string, unknown> = {};
        if (crop.candidatesFound != null) extra.candidates_found = crop.candidatesFound;
        sendApiError(res, "unprocessable_image", crop.error, undefined, extra);
        return;
      }

      consumeRateLimit(req.apiUser!.userId, "crop").catch((err) =>
        console.error("v1 crop rate limit consume failed:", err)
      );

      incrementApiUsage(req.apiUser!.keyId).catch((err) =>
        console.error("api usage increment failed:", err)
      );

      archiveCropAsync({
        png: crop.pngBuffer,
        idImage: crop.idImageJpeg ? Buffer.from(crop.idImageJpeg, "base64") : undefined,
        source: "api",
        width: typeof crop.metadata.width === "number" ? crop.metadata.width : undefined,
        height: typeof crop.metadata.height === "number" ? crop.metadata.height : undefined,
        pipelineConfidence:
          typeof crop.metadata.confidence === "number" ? crop.metadata.confidence : null,
        metadata: crop.metadata as Record<string, unknown>,
      });

      const contentHash = crypto.createHash("sha256").update(crop.pngBuffer).digest("hex");
      const wantsPng = req.accepts(["json", "image/png"]) === "image/png";

      let outBuffer = crop.pngBuffer;
      let outBase64 = crop.pngBase64;
      const plan = await getPlan(req.apiUser!.userId);
      if (
        shouldWatermarkCrop({ role: req.apiUser!.role, plan, billing: plan === "free" ? "free" : "subscription" })
      ) {
        try {
          outBuffer = await applyCropWatermark(outBuffer);
          outBase64 = outBuffer.toString("base64");
        } catch (err) {
          console.error("v1 crop watermark failed:", err);
        }
      }

      logActivity({
        userId: req.apiUser!.userId,
        action: "crop.api",
        actorId: req.apiUser!.userId,
        detail: { key_id: req.apiUser!.keyId, format: wantsPng ? "png" : "json" },
      });

      logUsageEvent({
        userId: req.apiUser!.userId,
        kind: "crop",
        source: "api",
        billing: "subscription",
        plan: "api",
        summary: resolved.filename,
        detail: {
          key_id: req.apiUser!.keyId,
          format: wantsPng ? "png" : "json",
          content_hash: contentHash,
          pipeline_confidence:
            typeof crop.metadata.confidence === "number" ? crop.metadata.confidence : null,
          width: typeof crop.metadata.width === "number" ? crop.metadata.width : null,
          height: typeof crop.metadata.height === "number" ? crop.metadata.height : null,
        },
      });

      if (wantsPng) {
        res.set({
          "Content-Type": "image/png",
          "Content-Length": outBuffer.length.toString(),
        });
        res.send(outBuffer);
        return;
      }

      res.json({
        image_base64: outBase64,
        metadata: crop.metadata,
      });
    } catch (err) {
      if (err instanceof RemoteFetchError) {
        sendApiError(res, "invalid_request", err.message);
        return;
      }
      console.error("v1 crop error:", err);
      sendApiError(res, "internal_error", "Unexpected error.");
    } finally {
      unlinkTemp(tempPath, ownTemp);
    }
  }
);

// GET /v1/crop/limits
router.get("/crop/limits", requireApiKey, async (req: Request, res: Response) => {
  const limit = await peekRateLimit(req.apiUser!.userId);
  res.set(rateLimitHeaders(limit));
  let usedToday = 0;
  try {
    usedToday = await getApiUsageTodayForUser(req.apiUser!.userId);
  } catch {
    // non-fatal
  }
  res.json({
    plan: "api",
    rate_limit_scope: "account",
    rate_limit_per_minute: limit.limit,
    remaining_this_minute: limit.remaining,
    reset_at: new Date(limit.resetMs).toISOString(),
    crops_today: usedToday,
    daily_soft_cap: DAILY_SOFT_CAP,
  });
});

// POST /v1/grade/straighten
router.post(
  "/grade/straighten",
  requireApiKey,
  rateLimitStraighten,
  multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_REMOTE_BYTES } }).single(
    "image"
  ),
  async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      sendApiError(res, "invalid_request", "No image provided.");
      return;
    }
    const sniff = await validateMulterFile(file);
    if (!sniff.ok) {
      sendApiError(res, "unsupported_media_type", sniff.error);
      return;
    }
    const out = await straightenGradeImage(file, tmpDir);
    if (!out.ok) {
      sendApiError(res, "unprocessable_image", out.error);
      return;
    }
    await consumeApiRateLimit(req.apiUser!.userId, "straighten");
    res.json({ png: out.png });
  }
);

// POST /v1/grade/centering-preview
router.post(
  "/grade/centering-preview",
  requireApiKey,
  apiRateLimitPeek("api:centering_preview"),
  async (req: Request, res: Response) => {
  try {
    const centering = parseCentering((req.body as Record<string, unknown>)?.centering);
    if (!centering) {
      sendApiError(
        res,
        "invalid_request",
        "Valid centering JSON with at least one ratio is required."
      );
      return;
    }
    const preview = previewCentering(centering);
    await consumeApiActionRateLimitSlot(req.apiUser!.userId, "api:centering_preview");
    res.json({ preview });
  } catch (err) {
    console.error("v1 centering preview error:", err);
    sendApiError(res, "internal_error", "Unexpected error during centering preview.");
  }
});

// GET /v1/grade/quota
router.get("/grade/quota", requireApiKey, async (req: Request, res: Response) => {
  try {
    const quota = await getGradeQuota(req.apiUser!.userId, req.apiUser!.role);
    res.json({ quota });
  } catch (err) {
    console.error("v1 grade quota failed:", err);
    sendApiError(res, "internal_error", "Failed to load grading quota.");
  }
});

// POST /v1/grade
router.post(
  "/grade",
  requireApiKey,
  apiRateLimitPeek("api:grade"),
  gradeUpload,
  async (req: Request, res: Response) => {
  const uploadErr = await validateGradeFileMap(req.files as Record<string, Express.Multer.File[]>);
  if (uploadErr) {
    sendApiError(res, "unsupported_media_type", uploadErr);
    return;
  }

  const userId = req.apiUser!.userId;
  const idempotencyKey = normalizeIdempotencyKey(req.headers["idempotency-key"]);
  let claimedIdempotency = false;

  if (idempotencyKey) {
    try {
      const claim = await claimGradeIdempotency(userId, idempotencyKey);
      if (claim.action === "replay") {
        const cached = claim.body as GradeResponseBody;
        await respondGrade(req, res, cached);
        return;
      }
      if (claim.action === "wait") {
        sendApiError(
          res,
          "rate_limited",
          "A grade with this Idempotency-Key is already in progress.",
          { "Retry-After": String(claim.retryAfter) }
        );
        return;
      }
      claimedIdempotency = true;
    } catch (err) {
      console.error("idempotency claim failed:", err);
      sendApiError(res, "internal_error", "Could not verify idempotency key.");
      return;
    }
  }

  try {
    const centering = parseCentering((req.body as Record<string, unknown>)?.centering);
    const out = await executeGrade({
      userId,
      files: req.files as FileMap | undefined,
      centering,
      source: "api",
      role: req.apiUser!.role,
    });

    if (!out.ok) {
      if (idempotencyKey && claimedIdempotency) {
        await releaseGradeIdempotency(userId, idempotencyKey).catch((err) =>
          console.error("idempotency release failed:", err)
        );
      }
      mapGradeError(res, out);
      return;
    }

    const body: GradeResponseBody = {
      result: out.result,
      quota: out.quota,
      capture_quality: out.capture_quality,
    };
    if (idempotencyKey && claimedIdempotency) {
      await completeGradeIdempotency(userId, idempotencyKey, body);
    }
    await consumeApiActionRateLimitSlot(userId, "api:grade");
    await respondGrade(req, res, body);
  } catch (err) {
    if (idempotencyKey && claimedIdempotency) {
      await releaseGradeIdempotency(userId, idempotencyKey).catch(() => {});
    }
    console.error("v1 grade error:", err);
    sendApiError(res, "internal_error", "Unexpected error during grading.");
  }
});

// GET /v1/account
router.get("/account", requireApiKey, async (req: Request, res: Response) => {
  try {
    const userId = req.apiUser!.userId;
    const role = req.apiUser!.role;
    const [quota, activeKeys, cropsToday] = await Promise.all([
      getGradeQuota(userId, role),
      countActiveApiKeys(userId),
      getApiUsageTodayForUser(userId),
    ]);
    res.json({
      plan: "api",
      is_admin: role === "admin",
      grade_quota: quota,
      active_api_keys: activeKeys,
      crops_today: cropsToday,
    });
  } catch (err) {
    console.error("v1 account failed:", err);
    sendApiError(res, "internal_error", "Failed to load account.");
  }
});

// GET /v1/usage
router.get("/usage", requireApiKey, async (req: Request, res: Response) => {
  try {
    const kindRaw = typeof req.query.kind === "string" ? req.query.kind : "";
    const kind: UsageKind | undefined =
      kindRaw === "crop" || kindRaw === "grade" ? kindRaw : undefined;
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

    const result = await getHistory({
      userId: req.apiUser!.userId,
      kind,
      source: "api",
      q: str(req.query.q),
      from: str(req.query.from),
      to: str(req.query.to),
      page: req.query.page ? parseInt(String(req.query.page), 10) : undefined,
      pageSize: req.query.pageSize ? parseInt(String(req.query.pageSize), 10) : undefined,
    });
    res.json(result);
  } catch (err) {
    console.error("v1 usage failed:", err);
    sendApiError(res, "internal_error", "Failed to load usage history.");
  }
});

router.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

router.get("/version", (_req: Request, res: Response) => {
  res.json({ api: API_VERSION, spec: API_SPEC_VERSION });
});

router.get("/openapi.json", (_req: Request, res: Response) => {
  res.json(openApiSpec);
});

router.use((_req: Request, res: Response) => {
  sendApiError(res, "not_found", "Unknown API endpoint.");
});

export { router as apiV1Routes };
