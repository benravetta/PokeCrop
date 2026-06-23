import { Router, Request, Response } from "express";
import multer from "multer";
import os from "os";
import path from "path";
import fs from "fs";
import { requireAuth } from "../middleware/auth.js";
import {
  executeGrade,
  parseCentering,
  straightenGradeImage,
  type FileMap,
} from "../lib/gradeService.js";
import { getGradeQuota } from "../lib/gradeQuota.js";

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
  limits: { fileSize: 50 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const genericMime = !file.mimetype || file.mimetype === "application/octet-stream";
    if (GRADE_MIME.includes(file.mimetype) || (GRADE_EXT.includes(ext) && genericMime)) {
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
    const out = await straightenGradeImage(file, tmpDir);
    if (!out.ok) {
      res.status(422).json({ error: out.error });
      return;
    }
    res.json({ png: out.png });
  }
);

router.get("/grade/quota", requireAuth, async (req: Request, res: Response) => {
  try {
    const quota = await getGradeQuota(req.user!.id);
    res.json({ quota });
  } catch (err) {
    console.error("grade quota failed:", err);
    res.status(500).json({ error: "Failed to load grading quota." });
  }
});

router.post("/grade", requireAuth, gradeUpload, async (req: Request, res: Response) => {
  try {
    const centering = parseCentering((req.body as Record<string, unknown>)?.centering);
    const out = await executeGrade({
      userId: req.user!.id,
      files: req.files as FileMap | undefined,
      centering,
      source: "web",
      actorEmail: req.user!.email ?? null,
    });

    if (!out.ok) {
      const body: Record<string, unknown> = { error: out.message };
      if (out.quota) body.quota = out.quota;
      if (out.capture_quality) body.capture_quality = out.capture_quality;
      res.status(out.status).json(body);
      return;
    }

    res.json({
      result: out.result,
      quota: out.quota,
      capture_quality: out.capture_quality,
    });
  } catch (err) {
    console.error("grade error:", err);
    res.status(500).json({ error: "Unexpected error during grading." });
  }
});

export { router as gradeRoutes };
