import { Router, Request, Response } from "express";
import multer from "multer";
import fs from "fs";
import os from "os";
import path from "path";
import { v4 as uuid } from "uuid";
import { requireAuth } from "../middleware/auth.js";
import {
  gradeCard,
  isGradingConfigured,
  type GradeImageInput,
  type MeasuredCentering,
} from "../lib/grading.js";
import { getGradeQuota, incrementGrade } from "../lib/gradeQuota.js";
import { isSuspended } from "../lib/usage.js";
import { logActivity } from "../lib/activity.js";
import { sendToPython, transcodeViaPython } from "../services/pythonBridge.js";
import { validateParams } from "../lib/cropParams.js";

const router = Router();

const tmpDir = path.join(os.tmpdir(), "cardcrop-grade");
fs.mkdirSync(tmpDir, { recursive: true });

const GRADE_EXT = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".dng"];
const GRADE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/x-adobe-dng",
  "image/dng",
];

const upload = multer({
  storage: multer.memoryStorage(),
  // 50 MB to match nginx/process/python limits — native-resolution straightened
  // PNGs and phone HEIC/large JPEGs can be sizeable.
  limits: { fileSize: 50 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    // Some browsers send HEIC with an empty/generic mimetype; trust the
    // extension in that case.
    const genericMime = !file.mimetype || file.mimetype === "application/octet-stream";
    if (GRADE_MIME.includes(file.mimetype) || (GRADE_EXT.includes(ext) && genericMime)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type"));
    }
  },
});

// Formats the OpenAI vision API can read directly. Anything else (HEIC/HEIF)
// is transcoded to JPEG first.
const VISION_READY = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function isHeic(file: Express.Multer.File): boolean {
  const ext = path.extname(file.originalname || "").toLowerCase();
  return (
    file.mimetype === "image/heic" ||
    file.mimetype === "image/heif" ||
    ext === ".heic" ||
    ext === ".heif"
  );
}

// Build a vision-ready data URL, transcoding HEIC/unknown formats to JPEG via
// the Python service so OpenAI never receives a format it can't decode.
async function fileToVisionDataUrl(file: Express.Multer.File): Promise<string> {
  if (VISION_READY.has(file.mimetype) && !isHeic(file)) {
    return `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
  }
  const jpeg = await transcodeViaPython(file.buffer, file.originalname || "image");
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

// Parse the optional `centering` form field (JSON) into a MeasuredCentering.
function parseCentering(raw: unknown): MeasuredCentering | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  try {
    const v = JSON.parse(raw) as MeasuredCentering;
    if (!v || typeof v !== "object") return undefined;
    const ratio = (s: unknown) =>
      typeof s === "string" && /^\d{1,3}\/\d{1,3}$/.test(s) ? s : undefined;
    const out: MeasuredCentering = {};
    if (v.front)
      out.front = { leftRight: ratio(v.front.leftRight), topBottom: ratio(v.front.topBottom) };
    if (v.back)
      out.back = { leftRight: ratio(v.back.leftRight), topBottom: ratio(v.back.topBottom) };
    const hasAny =
      out.front?.leftRight || out.front?.topBottom || out.back?.leftRight || out.back?.topBottom;
    return hasAny ? out : undefined;
  } catch {
    return undefined;
  }
}

const gradeUpload = upload.fields([
  { name: "front", maxCount: 1 },
  { name: "back", maxCount: 1 },
  { name: "angled_front", maxCount: 1 },
  { name: "angled_back", maxCount: 1 },
  { name: "closeups", maxCount: 6 },
]);

type FileMap = Record<string, Express.Multer.File[]>;

async function toImages(files: FileMap | undefined): Promise<GradeImageInput[]> {
  if (!files) return [];
  const images: GradeImageInput[] = [];
  const add = async (label: GradeImageInput["label"], f?: Express.Multer.File) => {
    if (!f) return;
    try {
      images.push({ label, dataUrl: await fileToVisionDataUrl(f) });
    } catch (err) {
      // A transcode failure on one image must not kill the whole grade; the
      // required-front check below surfaces a clear error if the front drops.
      console.error(`grade: failed to prepare ${label} image:`, err);
    }
  };
  await add("front", files.front?.[0]);
  await add("back", files.back?.[0]);
  await add("angled_front", files.angled_front?.[0]);
  await add("angled_back", files.angled_back?.[0]);
  for (const f of files.closeups ?? []) await add("closeup", f);
  return images;
}

// POST /api/grade/straighten — run a single photo through the crop/straighten
// pipeline so centering can be measured on a clean, perspective-corrected card.
// Not metered against the crop quota; it's a helper for the grader.
router.post(
  "/grade/straighten",
  requireAuth,
  upload.single("image"),
  async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No image provided." });
      return;
    }
    const tempPath = path.join(tmpDir, `${uuid()}-${file.originalname || "card"}`);
    try {
      await fs.promises.writeFile(tempPath, file.buffer);
      // Grading needs an honest, perspective-corrected card with no
      // beautification that could mask condition, so request the grading-safe
      // variant from the staged pipeline.
      const result = await sendToPython(tempPath, file.originalname || "card", {
        ...validateParams({}),
        grading_safe: true,
        // Grading needs maximum detail: ask the pipeline for the native-resolution
        // crop (full_resolution => result_png), not the 1200px web preview.
        full_resolution: true,
      });
      const png = result.result_png ?? result.result_web_png;
      if (result.error || !png) {
        res.status(422).json({ error: "Could not detect a card to straighten." });
        return;
      }
      res.json({ png });
    } catch (err) {
      console.error("grade straighten failed:", err);
      res.status(500).json({ error: "Failed to straighten the image." });
    } finally {
      fs.unlink(tempPath, () => {});
    }
  }
);

// GET /api/grade/quota — current grading allowance for the signed-in user.
router.get("/grade/quota", requireAuth, async (req: Request, res: Response) => {
  try {
    const quota = await getGradeQuota(req.user!.id);
    res.json({ quota });
  } catch (err) {
    console.error("grade quota failed:", err);
    res.status(500).json({ error: "Failed to load grading quota." });
  }
});

// POST /api/grade — run a two-pass AI pre-grade on the uploaded card photos.
router.post("/grade", requireAuth, gradeUpload, async (req: Request, res: Response) => {
  const userId = req.user!.id;

  if (!isGradingConfigured()) {
    res.status(503).json({ error: "AI grading is not configured." });
    return;
  }

  const images = await toImages(req.files as FileMap | undefined);
  if (!images.some((i) => i.label === "front")) {
    res.status(400).json({ error: "A front image is required." });
    return;
  }

  try {
    if (await isSuspended(userId)) {
      res.status(403).json({ error: "Account suspended." });
      return;
    }

    const quota = await getGradeQuota(userId);
    if (quota.remaining <= 0) {
      res.status(429).json({
        error:
          quota.window === "month"
            ? "You've used your free grade for this month. Upgrade for more."
            : "You've reached today's grading limit.",
        quota,
      });
      return;
    }

    const centering = parseCentering((req.body as Record<string, unknown>)?.centering);
    const result = await gradeCard(images, userId, centering);
    if (!result) {
      res.status(502).json({ error: "Grading failed. Please try again." });
      return;
    }

    // The upload wasn't a trading card — don't spend the user's grade allowance
    // on it. Return the unchanged quota with a clear signal for the UI.
    if ((result as Record<string, unknown>).not_a_card === true) {
      logActivity({
        userId,
        action: "grade.web.not_a_card",
        actorId: userId,
        detail: { images: images.length },
      });
      res.json({ result, quota });
      return;
    }

    await incrementGrade(userId);
    logActivity({
      userId,
      action: "grade.web",
      actorId: userId,
      detail: {
        images: images.length,
        back: images.some((i) => i.label === "back"),
        centering: Boolean(centering),
      },
    });

    const updated = await getGradeQuota(userId);
    res.json({ result, quota: updated });
  } catch (err) {
    console.error("grade error:", err);
    res.status(500).json({ error: "Unexpected error during grading." });
  }
});

export { router as gradeRoutes };
