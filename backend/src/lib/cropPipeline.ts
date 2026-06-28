import { sendToPython } from "../services/pythonBridge.js";
import { assessCard, type CardAssessment } from "./cardVision.js";

export type MetadataLevel = "full" | "minimal";

export interface RunCropOptions {
  filePath: string;
  filename: string;
  params: Record<string, unknown>;
  userId: string;
  /** When true (default), return full-res PNG; when false, web preview outputs. */
  fullResolution?: boolean;
  identify?: boolean;
  includeSuitability?: boolean;
  metadataLevel?: MetadataLevel;
  /** Pre-computed assessment (web session cache); skips GPT when set. */
  cachedAssessment?: CardAssessment | null;
}

export interface CropJobSuccess {
  ok: true;
  pngBase64: string;
  pngBuffer: Buffer;
  resultWebPng?: string;
  editImageJpeg?: string;
  metadata: Record<string, unknown>;
  idImageJpeg?: string;
  suitability?: CardAssessment | null;
  candidatesFound?: number;
}

export type CropJobResult =
  | CropJobSuccess
  | { ok: false; error: string; candidatesFound?: number };

function readPngSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24) return null;
  if (buf.readUInt32BE(0) !== 0x89504e47) return null;
  if (buf.toString("ascii", 12, 16) !== "IHDR") return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/** Shape pipeline metadata for API consumers. */
export function shapeCropMetadata(
  meta: unknown,
  pngBuffer: Buffer | null,
  level: MetadataLevel,
  suitability?: CardAssessment | null
): Record<string, unknown> {
  const m = meta && typeof meta === "object" ? (meta as Record<string, unknown>) : {};
  const size = pngBuffer ? readPngSize(pngBuffer) : null;

  if (level === "full") {
    const out: Record<string, unknown> = { ...m };
    if (size) {
      out.width = size.width;
      out.height = size.height;
    }
    if (typeof m.estimated_corner_radius_px === "number" && out.corner_radius_px === undefined) {
      out.corner_radius_px = m.estimated_corner_radius_px;
    }
    if (Array.isArray(m.crop_corners) && out.corners === undefined) {
      out.corners = m.crop_corners;
    }
    if (typeof m.pipeline_time_ms === "number" && out.processing_ms === undefined) {
      out.processing_ms = m.pipeline_time_ms;
    }
    if (suitability) out.suitability = suitability;
    else if (m.suitability) out.suitability = m.suitability;
    return out;
  }

  const out: Record<string, unknown> = {};
  if (size) {
    out.width = size.width;
    out.height = size.height;
  }
  if (typeof m.confidence === "number") out.confidence = m.confidence;
  if (typeof m.needs_manual === "boolean") out.needs_manual = m.needs_manual;
  if (typeof m.needs_review === "boolean") out.needs_review = m.needs_review;
  if (typeof m.detection_path === "string") out.detection_path = m.detection_path;
  if (typeof m.scan_mode === "boolean") out.scan_mode = m.scan_mode;
  if (typeof m.rotation_deg === "number") out.rotation_deg = m.rotation_deg;
  if (typeof m.estimated_corner_radius_px === "number")
    out.corner_radius_px = m.estimated_corner_radius_px;
  if (Array.isArray(m.crop_corners)) out.corners = m.crop_corners;
  if (typeof m.pipeline_time_ms === "number") out.processing_ms = m.pipeline_time_ms;
  if (suitability) out.suitability = suitability;
  return out;
}

/** Run the crop pipeline with optional GPT suitability + ROI hint. */
export async function runCropJob(opts: RunCropOptions): Promise<CropJobResult> {
  const {
    filePath,
    filename,
    params,
    userId,
    fullResolution = true,
    identify = true,
    includeSuitability = true,
    metadataLevel = "full",
    cachedAssessment,
  } = opts;

  const pipelineParams = { ...params };

  let suitability: CardAssessment | null = cachedAssessment ?? null;
  if (includeSuitability && !suitability) {
    suitability = await assessCard(filePath, userId).catch(() => null);
  }
  if (suitability?.roi && pipelineParams.roi === undefined) {
    const r = suitability.roi;
    pipelineParams.roi = [r.x, r.y, r.w, r.h];
  }

  let result: Record<string, unknown>;
  try {
    result = await sendToPython(filePath, filename, {
      ...pipelineParams,
      full_resolution: fullResolution,
      identify,
    });
  } catch (err) {
    console.error("crop pipeline error:", err);
    return { ok: false, error: "Image processing failed." };
  }

  if (result.error) {
    return {
      ok: false,
      error: typeof result.error === "string" ? result.error : "No card detected.",
      candidatesFound:
        typeof result.candidates_found === "number" ? result.candidates_found : undefined,
    };
  }

  const resultPng = result.result_png as string | undefined;
  const resultWebPng = result.result_web_png as string | undefined;
  const primaryB64 = fullResolution ? resultPng : resultWebPng ?? resultPng;

  if (!primaryB64) {
    return { ok: false, error: "No image produced." };
  }

  const pngBuffer = Buffer.from(primaryB64, "base64");
  const meta = result.metadata;
  if (suitability && meta && typeof meta === "object") {
    (meta as Record<string, unknown>).suitability = suitability;
  }

  return {
    ok: true,
    pngBase64: fullResolution ? primaryB64 : resultPng ?? primaryB64,
    pngBuffer,
    resultWebPng: resultWebPng ?? undefined,
    editImageJpeg: result.edit_image_jpeg as string | undefined,
    metadata: shapeCropMetadata(
      meta,
      fullResolution ? pngBuffer : null,
      metadataLevel,
      suitability
    ),
    idImageJpeg: result.id_image_jpeg as string | undefined,
    suitability,
    candidatesFound:
      typeof result.candidates_found === "number" ? result.candidates_found : undefined,
  };
}
