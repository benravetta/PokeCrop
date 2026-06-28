import fs from "fs";
import os from "os";
import path from "path";
import { v4 as uuid } from "uuid";
import { runCropJob } from "../../lib/cropPipeline.js";
import { validateParams } from "../../lib/cropParams.js";
import { assessCardBlocking, applySuitabilityTierOverrides } from "../../lib/cardVision.js";
import { CollectorProfileError } from "../domain/types.js";

const tmpDir = path.join(os.tmpdir(), "collector-profiles-crop");
fs.mkdirSync(tmpDir, { recursive: true });

export interface CropProcessResult {
  pngBuffer: Buffer;
  metadata: Record<string, unknown>;
  needsManual: boolean;
  needsReview: boolean;
  editImageJpeg?: string;
  previewBase64?: string;
  suitability?: Record<string, unknown> | null;
  blocked?: boolean;
  blockReasons?: string[];
}

async function runCrop(opts: {
  buffer: Buffer;
  filename: string;
  userId: string;
  params?: Record<string, unknown>;
  fullResolution: boolean;
}): Promise<CropProcessResult> {
  const filePath = path.join(tmpDir, `${uuid()}-${opts.filename}`);
  await fs.promises.writeFile(filePath, opts.buffer);
  try {
    const params = validateParams(opts.params ?? {});
    const result = await runCropJob({
      filePath,
      filename: opts.filename,
      params,
      userId: opts.userId,
      fullResolution: opts.fullResolution,
      identify: true,
      includeSuitability: true,
      metadataLevel: "full",
    });
    if (!result.ok) {
      throw new CollectorProfileError("COLLECTOR_INVALID_INPUT", result.error, 422);
    }
    const meta = result.metadata ?? {};
    const blocking = assessCardBlocking(result.suitability ?? null);
    if (blocking.blocked) {
      return {
        pngBuffer: result.pngBuffer,
        metadata: meta,
        needsManual: false,
        needsReview: false,
        editImageJpeg: result.editImageJpeg,
        previewBase64: result.resultWebPng ?? result.pngBase64,
        suitability: result.suitability as Record<string, unknown> | null,
        blocked: true,
        blockReasons: blocking.reasons,
      };
    }
    const shaped = applySuitabilityTierOverrides(meta as Record<string, unknown>, blocking);
    const needsManual = Boolean(shaped.needs_manual);
    const needsReview = Boolean(shaped.needs_review);
    return {
      pngBuffer: result.pngBuffer,
      metadata: shaped,
      needsManual,
      needsReview,
      editImageJpeg: result.editImageJpeg,
      previewBase64: result.resultWebPng ?? result.pngBase64,
      suitability: result.suitability as Record<string, unknown> | null,
    };
  } finally {
    fs.unlink(filePath, () => {});
  }
}

export async function processCardImageCrop(opts: {
  buffer: Buffer;
  filename: string;
  userId: string;
  params?: Record<string, unknown>;
}): Promise<CropProcessResult> {
  const params = { grading_safe: true, ...(opts.params ?? {}) };
  return runCrop({ ...opts, params, fullResolution: true });
}

/** Preview-only detect (no quota, no R2 write). */
export async function previewCardImageCrop(opts: {
  buffer: Buffer;
  filename: string;
  userId: string;
  params?: Record<string, unknown>;
}): Promise<CropProcessResult> {
  return runCrop({ ...opts, fullResolution: false });
}

export async function detectCardBoundary(opts: {
  buffer: Buffer;
  filename: string;
  userId: string;
}): Promise<CropProcessResult> {
  return previewCardImageCrop({ ...opts, params: {} });
}
