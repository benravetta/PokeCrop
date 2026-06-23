import { chatComplete, isOpenAiConfigured } from "./openai.js";

export interface CaptureImageInput {
  label: string;
  buffer: Buffer;
  mime: string;
  originalname?: string;
}

export type CaptureIssueSeverity = "block" | "warn";

export interface CaptureIssue {
  code: string;
  severity: CaptureIssueSeverity;
  message: string;
}

export interface CaptureQualityResult {
  /** false when any blocking issue is present — caller should not run a full grade. */
  ok: boolean;
  /** Overall 0-100 heuristic score (deterministic + optional LLM). */
  score: number;
  rating: "excellent" | "good" | "limited" | "poor";
  issues: CaptureIssue[];
  front: { width: number; height: number; longEdge: number } | null;
  hasBack: boolean;
}

const MIN_LONG_EDGE_HARD = 720;
const MIN_LONG_EDGE_WARN = 1200;
const MIN_BYTES_WARN = 80_000;

/** Read PNG/JPEG dimensions from buffer headers (no decode library). */
export function imageDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24) return null;

  // PNG: IHDR at byte 16
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    if (width > 0 && height > 0 && width < 20000 && height < 20000) return { width, height };
    return null;
  }

  // JPEG: scan for SOF0 / SOF2
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = buf[i + 1];
      if (marker === 0xc0 || marker === 0xc2) {
        const height = buf.readUInt16BE(i + 5);
        const width = buf.readUInt16BE(i + 7);
        if (width > 0 && height > 0) return { width, height };
        return null;
      }
      const len = buf.readUInt16BE(i + 2);
      if (len < 2) break;
      i += 2 + len;
    }
  }

  return null;
}

interface VisionFlags {
  blurry?: boolean;
  glare?: boolean;
  sleeved?: boolean;
  fully_visible?: boolean;
}

async function visionFlags(
  dataUrl: string,
  userId: string
): Promise<VisionFlags | null> {
  if (!isOpenAiConfigured()) return null;
  const result = await chatComplete({
    model: process.env.CARD_ASSESS_MODEL || "gpt-4o-mini",
    system:
      "You inspect one trading-card photo for GRADING suitability. Return ONLY JSON: " +
      '{"blurry":boolean,"glare":boolean,"sleeved":boolean,"fully_visible":boolean}',
    user: "Is this photo sharp enough to grade surface/corners from? Any strong glare or sleeve?",
    images: [{ dataUrl, detail: "low" }],
    jsonObject: true,
    maxTokens: 120,
    temperature: 0,
    feature: "grade_capture_qa",
    userId,
    timeoutMs: 15000,
  });
  if (!result) return null;
  try {
    return JSON.parse(result.content) as VisionFlags;
  } catch {
    return null;
  }
}

function toDataUrl(buf: Buffer, mime: string): string {
  return `data:${mime};base64,${buf.toString("base64")}`;
}

function ratingFrom(score: number): CaptureQualityResult["rating"] {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "limited";
  return "poor";
}

/**
 * Pre-grade capture quality gate. Deterministic checks run first; a cheap vision
 * pass on the front flags blur/glare/sleeve when OpenAI is configured.
 */
export async function assessCaptureQuality(
  images: CaptureImageInput[],
  userId: string,
  opts?: { centeringMeasured?: boolean }
): Promise<CaptureQualityResult> {
  const issues: CaptureIssue[] = [];
  let score = 100;

  const front = images.find((i) => i.label === "front");
  const hasBack = images.some((i) => i.label === "back");

  if (!front) {
    return {
      ok: false,
      score: 0,
      rating: "poor",
      issues: [
        {
          code: "missing_front",
          severity: "block",
          message: "A front photo is required.",
        },
      ],
      front: null,
      hasBack: false,
    };
  }

  const dims = imageDimensions(front.buffer);
  const longEdge = dims ? Math.max(dims.width, dims.height) : 0;

  if (!dims || longEdge < MIN_LONG_EDGE_HARD) {
    issues.push({
      code: "resolution_too_low",
      severity: "block",
      message: `Front image is too small for reliable grading (${longEdge || "unknown"}px long edge). Use your camera's full resolution — at least ~1200px on the long side.`,
    });
    score -= 50;
  } else if (longEdge < MIN_LONG_EDGE_WARN) {
    issues.push({
      code: "resolution_low",
      severity: "warn",
      message: `Front resolution is usable but low (${longEdge}px). Full camera quality (~1500px+) improves surface and corner reads.`,
    });
    score -= 15;
  }

  if (front.buffer.length < MIN_BYTES_WARN) {
    issues.push({
      code: "heavy_compression",
      severity: "warn",
      message:
        "The front file looks heavily compressed. Upload the original photo, not a screenshot or re-shared image.",
    });
    score -= 10;
  }

  if (!hasBack) {
    issues.push({
      code: "missing_back",
      severity: "warn",
      message:
        "No back photo — gem-grade calls won't be reliable. Add a sharp back shot (flat, out of sleeve).",
    });
    score -= 20;
  }

  if (!opts?.centeringMeasured) {
    issues.push({
      code: "centering_not_measured",
      severity: "warn",
      message:
        "Centering wasn't measured on the straightened card. Use the centering tool (or confirm borders) for accurate subgrades.",
    });
    score -= 8;
  }

  // Cheap vision pass on front only.
  const flags = await visionFlags(toDataUrl(front.buffer, front.mime), userId);
  if (flags) {
    if (flags.blurry) {
      issues.push({
        code: "blurry",
        severity: "block",
        message: "The front photo looks out of focus. Hold steady, tap to focus, and retake before grading.",
      });
      score -= 40;
    }
    if (flags.glare) {
      issues.push({
        code: "glare",
        severity: "warn",
        message:
          "Strong glare detected. Tilt away from direct light — holos need even lighting to grade surface accurately.",
      });
      score -= 15;
    }
    if (flags.sleeved) {
      issues.push({
        code: "sleeved",
        severity: "warn",
        message:
          "The card appears to be in a sleeve or toploader. Lay it bare and flat for centering and edge reads.",
      });
      score -= 12;
    }
    if (flags.fully_visible === false) {
      issues.push({
        code: "cropped",
        severity: "warn",
        message: "Part of the card is cut off. Include the full card with a little border around it.",
      });
      score -= 10;
    }
  }

  score = Math.max(0, Math.min(100, score));
  const ok = !issues.some((i) => i.severity === "block");

  return {
    ok,
    score,
    rating: ratingFrom(score),
    issues,
    front: dims ? { ...dims, longEdge } : null,
    hasBack,
  };
}
