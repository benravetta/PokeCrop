import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import os from "os";
import { v4 as uuid } from "uuid";
import { sendToPython } from "../services/pythonBridge.js";
import { requireApiKey } from "../middleware/apiKey.js";
import { validateParams } from "../lib/cropParams.js";
import { sendApiError } from "../lib/apiError.js";
import { incrementApiUsage, getApiUsageToday } from "../lib/apiKeys.js";
import { logActivity } from "../lib/activity.js";
import { logUsageEvent } from "../lib/usageEvents.js";
import { archiveCropAsync } from "../lib/catalog.js";
import { fetchRemoteImage, RemoteFetchError, MAX_REMOTE_BYTES } from "../lib/ssrf.js";
import { rateLimit, rateLimitHeaders, DAILY_SOFT_CAP } from "../lib/rateLimit.js";
import { openApiSpec } from "../openapi.js";
import { assessCard } from "../lib/cardVision.js";

export const API_VERSION = "v1";

const router = Router();

const tmpDir = path.join(os.tmpdir(), "cardcrop-api");
fs.mkdirSync(tmpDir, { recursive: true });

const ALLOWED_EXT = [".jpg", ".jpeg", ".png", ".webp", ".pdf", ".heic", ".heif", ".dng"];
const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "image/heic",
  "image/heif",
  "image/x-adobe-dng",
  "image/dng",
];

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
    // HEIC uploads sometimes arrive with an empty/generic mimetype.
    const genericMime = !file.mimetype || file.mimetype === "application/octet-stream";
    if (ALLOWED_EXT.includes(ext) && (ALLOWED_MIME.includes(file.mimetype) || genericMime)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext || file.mimetype}`));
    }
  },
});

// Sniff a sensible extension from magic bytes so the Python service can tell an
// image from a PDF even when the source had no usable filename (base64/url).
function extFromMagic(buf: Buffer): string {
  if (buf.length >= 4) {
    if (buf[0] === 0x89 && buf[1] === 0x50) return ".png"; // PNG
    if (buf[0] === 0xff && buf[1] === 0xd8) return ".jpg"; // JPEG
    if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46)
      return ".pdf"; // %PDF
    if (
      buf.length >= 12 &&
      buf.toString("ascii", 0, 4) === "RIFF" &&
      buf.toString("ascii", 8, 12) === "WEBP"
    )
      return ".webp";
    // HEIC/HEIF: ISO-BMFF with an "ftyp" box and a heic/heif-family brand.
    if (buf.length >= 12 && buf.toString("ascii", 4, 8) === "ftyp") {
      const brand = buf.toString("ascii", 8, 12);
      if (["heic", "heix", "heif", "mif1", "msf1", "hevc"].includes(brand)) return ".heic";
    }
    // DNG is TIFF-based ("II*\0" little-endian or "MM\0*" big-endian). We don't
    // accept plain TIFF, so treat a TIFF header as a raw DNG.
    if (
      (buf[0] === 0x49 && buf[1] === 0x49 && buf[2] === 0x2a && buf[3] === 0x00) ||
      (buf[0] === 0x4d && buf[1] === 0x4d && buf[2] === 0x00 && buf[3] === 0x2a)
    )
      return ".dng";
  }
  return "";
}

function decodeBase64Image(input: string): Buffer | null {
  // Accept raw base64 or a data URL.
  const m = input.match(/^data:[^;,]+;base64,(.*)$/s);
  const b64 = m ? m[1] : input;
  try {
    const buf = Buffer.from(b64, "base64");
    return buf.length > 0 ? buf : null;
  } catch {
    return null;
  }
}

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

async function writeTempFile(buffer: Buffer, ext: string): Promise<string> {
  const p = path.join(tmpDir, `${uuid()}${ext || ".bin"}`);
  await fs.promises.writeFile(p, buffer);
  return p;
}

// Read width/height from a PNG's IHDR chunk (cheap; no image library needed).
function readPngSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24) return null;
  if (buf.readUInt32BE(0) !== 0x89504e47) return null; // \x89PNG signature
  if (buf.toString("ascii", 12, 16) !== "IHDR") return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

// Expose a stable, documented subset of the pipeline metadata — never the
// internal scoring/candidate details, which are an implementation detail.
function shapeMetadata(
  meta: unknown,
  pngBuffer: Buffer
): Record<string, unknown> {
  const m = meta && typeof meta === "object" ? (meta as Record<string, unknown>) : {};
  const out: Record<string, unknown> = {};
  const size = readPngSize(pngBuffer);
  if (size) {
    out.width = size.width;
    out.height = size.height;
  }
  if (typeof m.confidence === "number") out.confidence = m.confidence;
  if (typeof m.needs_manual === "boolean") out.needs_manual = m.needs_manual;
  if (typeof m.rotation_deg === "number") out.rotation_deg = m.rotation_deg;
  if (typeof m.estimated_corner_radius_px === "number")
    out.corner_radius_px = m.estimated_corner_radius_px;
  if (Array.isArray(m.crop_corners)) out.corners = m.crop_corners;
  if (typeof m.pipeline_time_ms === "number") out.processing_ms = m.pipeline_time_ms;
  return out;
}

// POST /v1/crop — single-shot crop. Input: multipart `image`, or JSON
// { image_url } / { image_base64 }. Output: JSON { image_base64, metadata } by
// default, or raw image/png when the client sends `Accept: image/png`.
router.post(
  "/crop",
  requireApiKey,
  (req, res, next) => {
    // Limit per account, not per key, so creating extra keys can't multiply caps.
    const limit = rateLimit(req.apiUser!.userId);
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
  },
  upload.single("image"),
  async (req: Request, res: Response) => {
    let tempPath: string | null = null;
    let ownTemp = false; // true when we created the file (url/base64) and must unlink it

    try {
      let filename = "upload";

      if (req.file) {
        tempPath = req.file.path;
        ownTemp = true;
        filename = req.file.originalname || path.basename(req.file.path);
      } else if (typeof req.body?.image_url === "string" && req.body.image_url) {
        let remote;
        try {
          remote = await fetchRemoteImage(req.body.image_url);
        } catch (err) {
          if (err instanceof RemoteFetchError) {
            sendApiError(res, "invalid_request", err.message);
            return;
          }
          throw err;
        }
        const ext = path.extname(remote.filename) || extFromMagic(remote.buffer);
        tempPath = await writeTempFile(remote.buffer, ext);
        ownTemp = true;
        filename = remote.filename;
      } else if (
        typeof req.body?.image_base64 === "string" &&
        req.body.image_base64
      ) {
        const buf = decodeBase64Image(req.body.image_base64);
        if (!buf) {
          sendApiError(res, "invalid_request", "image_base64 is not valid base64.");
          return;
        }
        if (buf.length > MAX_REMOTE_BYTES) {
          sendApiError(res, "payload_too_large", "Image exceeds the 50 MB limit.");
          return;
        }
        const ext = extFromMagic(buf);
        if (!ext) {
          sendApiError(
            res,
            "unsupported_media_type",
            "Could not detect a supported image type (JPEG, PNG, WEBP, PDF)."
          );
          return;
        }
        tempPath = await writeTempFile(buf, ext);
        ownTemp = true;
        filename = `image${ext}`;
      } else {
        sendApiError(
          res,
          "invalid_request",
          "Provide an image via multipart 'image', or JSON 'image_url' or 'image_base64'."
        );
        return;
      }

      const params = parseParams(req.body?.params);

      // Best-effort suitability + rough ROI hint (cost-logged). Never blocks.
      const assessment = await assessCard(tempPath, req.apiUser!.userId).catch(() => null);
      if (assessment?.roi && params.roi === undefined) {
        const r = assessment.roi;
        params.roi = [r.x, r.y, r.w, r.h];
      }

      let result: Record<string, unknown>;
      try {
        result = await sendToPython(tempPath, filename, {
          ...params,
          full_resolution: true,
          identify: true,
        });
      } catch (err) {
        console.error("v1 crop processing error:", err);
        sendApiError(res, "processing_failed", "Image processing failed.");
        return;
      }

      if (result.error) {
        sendApiError(
          res,
          "unprocessable_image",
          typeof result.error === "string" ? result.error : "No card detected."
        );
        return;
      }

      const resultPng = result.result_png as string | undefined;
      if (!resultPng) {
        sendApiError(res, "processing_failed", "No image produced.");
        return;
      }

      const pngBuffer = Buffer.from(resultPng, "base64");

      // Meter the successful crop (best-effort; never block the response).
      incrementApiUsage(req.apiUser!.keyId).catch((err) =>
        console.error("api usage increment failed:", err)
      );

      // Archive the full-resolution crop to the R2 catalog (no-op if R2 is not
      // configured; de-duplicated by content hash; never blocks the response).
      const size = readPngSize(pngBuffer);
      const idImageB64 = result.id_image_jpeg as string | undefined;
      archiveCropAsync({
        png: pngBuffer,
        idImage: idImageB64 ? Buffer.from(idImageB64, "base64") : undefined,
        source: "api",
        width: size?.width,
        height: size?.height,
      });

      const wantsPng = req.accepts(["json", "image/png"]) === "image/png";
      logActivity({
        userId: req.apiUser!.userId,
        action: "crop.api",
        actorId: req.apiUser!.userId,
        detail: { key_id: req.apiUser!.keyId, format: wantsPng ? "png" : "json" },
      });
      // Permanent per-user history entry for API crops (API plan = unlimited, so
      // billed as subscription with no allowance number).
      logUsageEvent({
        userId: req.apiUser!.userId,
        kind: "crop",
        source: "api",
        billing: "subscription",
        plan: "api",
        summary: filename,
        detail: { key_id: req.apiUser!.keyId, format: wantsPng ? "png" : "json" },
      });

      if (wantsPng) {
        res.set({
          "Content-Type": "image/png",
          "Content-Length": pngBuffer.length.toString(),
        });
        res.send(pngBuffer);
        return;
      }

      res.json({
        image_base64: resultPng,
        metadata: shapeMetadata(result.metadata, pngBuffer),
      });
    } catch (err) {
      console.error("v1 crop error:", err);
      sendApiError(res, "internal_error", "Unexpected error.");
    } finally {
      if (tempPath && ownTemp) {
        fs.unlink(tempPath, () => {});
      }
    }
  }
);

// GET /v1/crop/limits — the caller's current rate-limit window + daily usage.
router.get("/crop/limits", requireApiKey, async (req: Request, res: Response) => {
  const limit = rateLimit(req.apiUser!.userId, { peek: true });
  res.set(rateLimitHeaders(limit));
  let usedToday = 0;
  try {
    usedToday = await getApiUsageToday(req.apiUser!.keyId);
  } catch {
    // non-fatal
  }
  res.json({
    plan: "api",
    rate_limit_per_minute: limit.limit,
    remaining_this_minute: limit.remaining,
    reset_at: new Date(limit.resetMs).toISOString(),
    crops_today: usedToday,
    daily_soft_cap: DAILY_SOFT_CAP,
  });
});

router.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

router.get("/version", (_req: Request, res: Response) => {
  res.json({ api: API_VERSION });
});

router.get("/openapi.json", (_req: Request, res: Response) => {
  res.json(openApiSpec);
});

// Unknown /v1 path: respond with the structured envelope (not Express's HTML 404).
router.use((_req: Request, res: Response) => {
  sendApiError(res, "not_found", "Unknown API endpoint.");
});

export { router as apiV1Routes };
