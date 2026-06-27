import fs from "fs";
import os from "os";
import path from "path";
import { v4 as uuid } from "uuid";
import { runCropJob } from "../../lib/cropPipeline.js";
import { validateParams } from "../../lib/cropParams.js";
import { CollectorProfileError } from "../domain/types.js";

const tmpDir = path.join(os.tmpdir(), "collector-profiles-crop");
fs.mkdirSync(tmpDir, { recursive: true });

export interface CropProcessResult {
  pngBuffer: Buffer;
  metadata: Record<string, unknown>;
  needsManual: boolean;
}

export async function processCardImageCrop(opts: {
  buffer: Buffer;
  filename: string;
  userId: string;
  params?: Record<string, unknown>;
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
      fullResolution: true,
      identify: true,
      includeSuitability: true,
      metadataLevel: "full",
    });
    if (!result.ok) {
      throw new CollectorProfileError("COLLECTOR_INVALID_INPUT", result.error, 422);
    }
    const meta = result.metadata ?? {};
    const needsManual = Boolean(
      (meta as Record<string, unknown>).needs_manual ??
        (meta as Record<string, unknown>).needsManual
    );
    return {
      pngBuffer: result.pngBuffer,
      metadata: meta,
      needsManual,
    };
  } finally {
    fs.unlink(filePath, () => {});
  }
}

export async function detectCardBoundary(opts: {
  buffer: Buffer;
  filename: string;
  userId: string;
}): Promise<CropProcessResult> {
  return processCardImageCrop({ ...opts, params: {} });
}
