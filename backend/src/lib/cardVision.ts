import fs from "fs";
import path from "path";
import { chatComplete, isOpenAiConfigured } from "./openai.js";

// Lightweight pre-crop assessor. Uses gpt-4o-mini to judge whether an uploaded
// photo is suitable for cropping and to provide a *rough* normalised region of
// interest (never the final corners — that is pure computer vision in Python).
// All spend is cost-logged through chatComplete -> ai_usage.

const MODEL = process.env.CARD_ASSESS_MODEL || "gpt-4o-mini";

export interface NormalisedRoi {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CardAssessment {
  present: boolean;
  single: boolean;
  fully_visible: boolean;
  touches_edge: boolean;
  blurry: boolean;
  glare: boolean;
  sleeved: boolean;
  side: "front" | "back" | "unknown";
  orientation: "upright" | "rotated" | "upside_down" | "unknown";
  roi?: NormalisedRoi;
  // Non-technical retake guidance derived from the flags above.
  guidance: string[];
}

const SYSTEM = `You inspect a single photo of a trading card (Pokemon, One Piece, Magic, sports, etc.) that is about to be auto-cropped.
Return STRICT JSON only, no prose. Judge the photo, do not guess the card name.
Schema:
{
  "present": boolean,        // is a trading card visible at all
  "single": boolean,         // exactly one card (false if multiple cards)
  "fully_visible": boolean,  // the whole card is inside the frame
  "touches_edge": boolean,   // the card is cut off by the photo edge
  "blurry": boolean,         // out of focus / motion blur
  "glare": boolean,          // strong glare/reflection covering part of the card
  "sleeved": boolean,        // card is inside a sleeve/toploader
  "side": "front"|"back"|"unknown",
  "orientation": "upright"|"rotated"|"upside_down"|"unknown",
  "roi": { "x": number, "y": number, "w": number, "h": number } // card bounding box as fractions 0..1 of the image (x,y top-left)
}`;

export function buildGuidance(a: Omit<CardAssessment, "guidance">): string[] {
  const g: string[] = [];
  if (!a.present) g.push("We couldn't see a card. Place the card flat and fill most of the frame.");
  else {
    if (!a.single) g.push("We see more than one card. Photograph a single card at a time.");
    if (a.touches_edge)
      g.push("Part of the card is cut off. Include the whole card with a little space around it.");
    if (a.blurry) g.push("The photo looks blurry. Hold steady and tap to focus, then retake.");
    if (a.glare) g.push("There's glare on the card. Tilt away from direct light to reduce reflections.");
  }
  return g;
}

function clamp01(n: unknown, def: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return def;
  return Math.max(0, Math.min(1, v));
}

function imageToDataUrl(filePath: string): string | null {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const mime =
      ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
    if (ext === ".pdf") return null; // assessor only handles photos
    const buf = fs.readFileSync(filePath);
    if (buf.length > 12 * 1024 * 1024) return null; // keep the call cheap/fast
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

// Assess an uploaded photo. Returns null when OpenAI is unconfigured or the call
// fails — callers then proceed with pure CV and no guidance (graceful degrade).
export async function assessCard(
  filePath: string,
  userId?: string | null
): Promise<CardAssessment | null> {
  if (!isOpenAiConfigured()) return null;
  const dataUrl = imageToDataUrl(filePath);
  if (!dataUrl) return null;

  const result = await chatComplete({
    model: MODEL,
    system: SYSTEM,
    user: "Inspect this card photo and return the JSON.",
    images: [{ dataUrl, detail: "low" }],
    jsonObject: true,
    maxTokens: 300,
    temperature: 0,
    feature: "card_assess",
    userId: userId ?? null,
    timeoutMs: 20000,
  });
  if (!result) return null;

  try {
    const j = JSON.parse(result.content) as Record<string, unknown>;
    let roi: NormalisedRoi | undefined;
    if (j.roi && typeof j.roi === "object") {
      const r = j.roi as Record<string, unknown>;
      const x = clamp01(r.x, 0);
      const y = clamp01(r.y, 0);
      const w = clamp01(r.w, 1);
      const h = clamp01(r.h, 1);
      if (w > 0.04 && h > 0.04) roi = { x, y, w, h };
    }
    const base = {
      present: j.present !== false,
      single: j.single !== false,
      fully_visible: j.fully_visible !== false,
      touches_edge: j.touches_edge === true,
      blurry: j.blurry === true,
      glare: j.glare === true,
      sleeved: j.sleeved === true,
      side: (j.side === "back" ? "back" : j.side === "front" ? "front" : "unknown") as
        | "front"
        | "back"
        | "unknown",
      orientation: (["upright", "rotated", "upside_down"].includes(String(j.orientation))
        ? j.orientation
        : "unknown") as CardAssessment["orientation"],
      roi,
    };
    return { ...base, guidance: buildGuidance(base) };
  } catch {
    return null;
  }
}

export interface CardBlockingResult {
  blocked: boolean;
  reasons: string[];
  /** When true, downstream should force at least Review tier even if CV confidence is high. */
  forceReview: boolean;
}

/** Hard blocks and soft downgrades for accuracy-first crop gating. */
export function assessCardBlocking(assessment: CardAssessment | null): CardBlockingResult {
  if (!assessment) {
    return { blocked: false, reasons: [], forceReview: false };
  }

  const reasons: string[] = [];
  if (!assessment.present) {
    reasons.push("We couldn't see a card. Place the card flat and fill most of the frame.");
  }
  if (!assessment.single) {
    reasons.push("We see more than one card. Photograph a single card at a time.");
  }
  if (assessment.touches_edge && !assessment.fully_visible) {
    reasons.push("Part of the card is cut off. Include the whole card with a little space around it.");
  }
  if (assessment.blurry) {
    reasons.push("The photo looks blurry. Hold steady and tap to focus, then retake.");
  }

  const forceReview = assessment.glare || assessment.sleeved;
  return {
    blocked: reasons.length > 0,
    reasons,
    forceReview,
  };
}

export function applySuitabilityTierOverrides(
  metadata: Record<string, unknown>,
  blocking: CardBlockingResult
): Record<string, unknown> {
  if (!blocking.forceReview) return metadata;
  if (metadata.needs_manual === true) return metadata;
  return {
    ...metadata,
    needs_review: true,
    needs_manual: false,
  };
}
