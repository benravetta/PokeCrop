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
import { sendToPython } from "../services/pythonBridge.js";
import { validateParams } from "../lib/cropParams.js";

const router = Router();

const tmpDir = path.join(os.tmpdir(), "cardcrop-grade");
fs.mkdirSync(tmpDir, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type"));
    }
  },
});

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

function toImages(files: FileMap | undefined): GradeImageInput[] {
  if (!files) return [];
  const images: GradeImageInput[] = [];
  const add = (label: GradeImageInput["label"], f?: Express.Multer.File) => {
    if (f) {
      images.push({
        label,
        dataUrl: `data:${f.mimetype};base64,${f.buffer.toString("base64")}`,
      });
    }
  };
  add("front", files.front?.[0]);
  add("back", files.back?.[0]);
  add("angled_front", files.angled_front?.[0]);
  add("angled_back", files.angled_back?.[0]);
  for (const f of files.closeups ?? []) add("closeup", f);
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
      });
      if (result.error || !result.result_web_png) {
        res.status(422).json({ error: "Could not detect a card to straighten." });
        return;
      }
      res.json({ png: result.result_web_png });
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

  const images = toImages(req.files as FileMap | undefined);
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
