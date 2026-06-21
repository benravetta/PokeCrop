import { Router, Request, Response } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth.js";
import { gradeCard, isGradingConfigured, type GradeImageInput } from "../lib/grading.js";
import { getGradeQuota, incrementGrade } from "../lib/gradeQuota.js";
import { isSuspended } from "../lib/usage.js";
import { logActivity } from "../lib/activity.js";

const router = Router();

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

    const result = await gradeCard(images, userId);
    if (!result) {
      res.status(502).json({ error: "Grading failed. Please try again." });
      return;
    }

    await incrementGrade(userId);
    logActivity({
      userId,
      action: "grade.web",
      actorId: userId,
      detail: { images: images.length, back: images.some((i) => i.label === "back") },
    });

    const updated = await getGradeQuota(userId);
    res.json({ result, quota: updated });
  } catch (err) {
    console.error("grade error:", err);
    res.status(500).json({ error: "Unexpected error during grading." });
  }
});

export { router as gradeRoutes };
