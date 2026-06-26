import { Router, Request, Response } from "express";
import multer from "multer";
import os from "os";
import path from "path";
import fs from "fs";
import { requireActiveAuth } from "../middleware/auth.js";
import {
  executeGrade,
  parseCentering,
  straightenGradeImage,
  type FileMap,
} from "../lib/gradeService.js";
import { previewCentering } from "../lib/centeringPreview.js";
import { getGradeQuota } from "../lib/gradeQuota.js";
import { webRateLimitPeek } from "../middleware/webRateLimit.js";
import { consumeWebRateLimitSlot } from "../lib/accountRateLimit.js";
import { validateGradeFileMap, validateMulterFile } from "../lib/uploadValidation.js";

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
  requireActiveAuth,
  upload.single("image"),
  webRateLimitPeek("web:grade_straighten"),
  async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No image provided." });
      return;
    }
    const sniff = await validateMulterFile(file);
    if (!sniff.ok) {
      res.status(415).json({ error: sniff.error });
      return;
    }
    const out = await straightenGradeImage(file, tmpDir);
    if (!out.ok) {
      res.status(422).json({ error: out.error });
      return;
    }
    await consumeWebRateLimitSlot(req.user!.id, "web:grade_straighten");
    res.json({ png: out.png });
  }
);

router.get("/grade/quota", requireActiveAuth, async (req: Request, res: Response) => {
  try {
    const quota = await getGradeQuota(req.user!.id, req.user!.role);
    res.json({ quota });
  } catch (err) {
    console.error("grade quota failed:", err);
    res.status(500).json({ error: "Failed to load grading quota." });
  }
});

router.post(
  "/grade/centering-preview",
  requireActiveAuth,
  webRateLimitPeek("web:centering_preview"),
  async (req: Request, res: Response) => {
  try {
    const centering = parseCentering((req.body as Record<string, unknown>)?.centering);
    if (!centering) {
      res.status(400).json({ error: "Valid centering JSON with at least one ratio is required." });
      return;
    }
    const preview = previewCentering(centering);
    await consumeWebRateLimitSlot(req.user!.id, "web:centering_preview");
    res.json({ preview });
  } catch (err) {
    console.error("centering preview error:", err);
    res.status(500).json({ error: "Unexpected error during centering preview." });
  }
});

router.post(
  "/grade",
  requireActiveAuth,
  gradeUpload,
  webRateLimitPeek("web:grade"),
  async (req: Request, res: Response) => {
  try {
    const uploadErr = await validateGradeFileMap(req.files as Record<string, Express.Multer.File[]>);
    if (uploadErr) {
      res.status(415).json({ error: uploadErr });
      return;
    }
    const centering = parseCentering((req.body as Record<string, unknown>)?.centering);
    const out = await executeGrade({
      userId: req.user!.id,
      files: req.files as FileMap | undefined,
      centering,
      source: "web",
      actorEmail: req.user!.email ?? null,
      role: req.user!.role,
    });

    if (!out.ok) {
      const body: Record<string, unknown> = { error: out.message };
      if (out.quota) body.quota = out.quota;
      if (out.capture_quality) body.capture_quality = out.capture_quality;
      res.status(out.status).json(body);
      return;
    }

    await consumeWebRateLimitSlot(req.user!.id, "web:grade");
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
