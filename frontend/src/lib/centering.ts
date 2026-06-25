// Centering measurement for the AI Pre-Grader.
//
// Grading centering is the colored BORDER of the card: the band between the
// card's outer cut edge and the inner edge where the printed artwork/frame
// begins. We measure it with TWO rectangles the user can fine-tune:
//   - outer = the card's outer cut edge
//   - inner = where the inner border meets the artwork
// The border width on a side is the gap between those two rectangles, and the
// ratio for an axis is `larger / (left + right) * 100`, written larger-first
// (e.g. "55/45"). The worst of the two axes sets the centering ceiling.
//
// We measure on a STRAIGHTENED card so the rectangles stay axis-aligned and the
// corner points are square.

// A rectangle in normalised image coordinates (0..1), edges as fractions.
export interface Box {
  x0: number; // left
  y0: number; // top
  x1: number; // right
  y1: number; // bottom
}

export interface AxisRatio {
  ratio: string; // larger-side-first, e.g. "55/45"
  larger: number; // larger side's percentage (50..100)
}

export interface CenteringResult {
  leftRight: AxisRatio;
  topBottom: AxisRatio;
}

export type CardSide = "front" | "back";

export const FULL_BOX: Box = { x0: 0, y0: 0, x1: 1, y1: 1 };
const DEFAULT_INNER: Box = { x0: 0.09, y0: 0.07, x1: 0.91, y1: 0.93 };

function axisRatio(a: number, b: number): AxisRatio {
  const total = a + b;
  if (total <= 0) return { ratio: "50/50", larger: 50 };
  const largerPct = Math.round((Math.max(a, b) / total) * 100);
  return { ratio: `${largerPct}/${100 - largerPct}`, larger: largerPct };
}

// Border widths between the outer (card edge) and inner (art edge) rectangles.
export function borderWidths(outer: Box, inner: Box) {
  return {
    left: Math.max(0, inner.x0 - outer.x0),
    right: Math.max(0, outer.x1 - inner.x1),
    top: Math.max(0, inner.y0 - outer.y0),
    bottom: Math.max(0, outer.y1 - inner.y1),
  };
}

export function borderRatios(outer: Box, inner: Box): CenteringResult {
  const w = borderWidths(outer, inner);
  return {
    leftRight: axisRatio(w.left, w.right),
    topBottom: axisRatio(w.top, w.bottom),
  };
}

/** Standard TCG cut assumption for mm estimates from normalised geometry. */
export const STANDARD_CARD_WIDTH_MM = 63;
export const STANDARD_CARD_HEIGHT_MM = 88;

export interface BorderWidthsNormalized {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface BorderWidthsWithMm extends BorderWidthsNormalized {
  leftMm: number;
  rightMm: number;
  topMm: number;
  bottomMm: number;
}

export function borderWidthsWithMm(outer: Box, inner: Box): BorderWidthsWithMm {
  const w = borderWidths(outer, inner);
  const cardW = outer.x1 - outer.x0;
  const cardH = outer.y1 - outer.y0;
  return {
    ...w,
    leftMm: cardW > 0 ? (w.left / cardW) * STANDARD_CARD_WIDTH_MM : 0,
    rightMm: cardW > 0 ? (w.right / cardW) * STANDARD_CARD_WIDTH_MM : 0,
    topMm: cardH > 0 ? (w.top / cardH) * STANDARD_CARD_HEIGHT_MM : 0,
    bottomMm: cardH > 0 ? (w.bottom / cardH) * STANDARD_CARD_HEIGHT_MM : 0,
  };
}

export interface MeasurementHeuristics {
  sleeveSuspected?: boolean;
  lowContrastBorder?: boolean;
  borderlessDesign?: boolean;
  perspectiveWarning?: boolean;
}

export interface MeasurementConfidenceInput {
  autoDetectOk: boolean;
  outer: Box;
  inner: Box;
  imageLongEdge?: number;
  userAdjustmentDelta?: number;
  skipped?: boolean;
  heuristics?: MeasurementHeuristics;
}

/** Compute 0–1 measurement confidence from box sanity and image quality heuristics. */
export function computeMeasurementConfidence(input: MeasurementConfidenceInput): number {
  if (input.skipped) return 0;
  let score = input.autoDetectOk ? 0.82 : 0.68;
  const w = borderWidths(input.outer, input.inner);
  const minBorder = Math.min(w.left, w.right, w.top, w.bottom);
  const maxBorder = Math.max(w.left, w.right, w.top, w.bottom);
  if (minBorder < 0.008) score -= 0.15;
  if (maxBorder > 0.22) score -= 0.1;
  if (input.imageLongEdge != null) {
    if (input.imageLongEdge >= 1200) score += 0.06;
    else if (input.imageLongEdge < 800) score -= 0.12;
  }
  if (input.userAdjustmentDelta != null && input.userAdjustmentDelta > 0.08) score -= 0.08;
  const h = input.heuristics;
  if (h?.lowContrastBorder) score -= 0.15;
  if (h?.sleeveSuspected) score -= 0.25;
  if (h?.borderlessDesign) score -= 0.2;
  if (h?.perspectiveWarning) score -= 0.2;
  return Math.max(0.2, Math.min(0.98, score));
}

export interface SideMeasurementMeta {
  borderWidths?: BorderWidthsWithMm;
  measurement_confidence?: number;
  detectionQuality?: "good" | "fair" | "poor";
  sleeveSuspected?: boolean;
  lowContrastBorder?: boolean;
  borderlessDesign?: boolean;
  perspectiveWarning?: boolean;
  userAdjustmentDelta?: number;
}

export function sideMeasurementMeta(
  outer: Box,
  inner: Box,
  opts: {
    autoDetectOk?: boolean;
    imageLongEdge?: number;
    userAdjustmentDelta?: number;
    heuristics?: MeasurementHeuristics;
  } = {}
): SideMeasurementMeta {
  const confidence = computeMeasurementConfidence({
    autoDetectOk: opts.autoDetectOk ?? true,
    outer,
    inner,
    imageLongEdge: opts.imageLongEdge,
    userAdjustmentDelta: opts.userAdjustmentDelta,
    heuristics: opts.heuristics,
  });
  let detectionQuality: "good" | "fair" | "poor" = "good";
  if (confidence < 0.55) detectionQuality = "poor";
  else if (confidence < 0.75) detectionQuality = "fair";
  return {
    borderWidths: borderWidthsWithMm(outer, inner),
    measurement_confidence: Math.round(confidence * 100) / 100,
    detectionQuality,
    ...opts.heuristics,
    userAdjustmentDelta: opts.userAdjustmentDelta,
  };
}

function colourDist(a: number[], b: number[]): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

interface Sampler {
  w: number;
  h: number;
  px: (x: number, y: number) => number[];
}

function sampler(img: HTMLImageElement): Sampler | null {
  const MAX = 520;
  const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return null;
  }
  return {
    w,
    h,
    px: (x, y) => {
      const i = (y * w + x) * 4;
      return [data[i], data[i + 1], data[i + 2]];
    },
  };
}

// Mean colour of a line (column if vertical, row if horizontal) over its
// central 60% to avoid rounded corners.
function lineMean(s: Sampler, idx: number, vertical: boolean): number[] {
  const span = vertical ? s.h : s.w;
  const lo = Math.floor(span * 0.2);
  const hi = Math.ceil(span * 0.8);
  let r = 0, g = 0, b = 0, n = 0;
  for (let k = lo; k < hi; k += 2) {
    const c = vertical ? s.px(idx, k) : s.px(k, idx);
    r += c[0]; g += c[1]; b += c[2]; n++;
  }
  return n ? [r / n, g / n, b / n] : [0, 0, 0];
}

// Find the fraction (0..1) where the colour first deviates from `ref` by more
// than THRESH for RUN consecutive lines, scanning inward from one edge.
function firstTransition(
  s: Sampler,
  ref: number[],
  vertical: boolean,
  fromStart: boolean,
  startFrac: number,
  limitFrac: number
): number | null {
  const span = vertical ? s.w : s.h; // index axis: x for vertical lines
  const THRESH = 40;
  const RUN = 3;
  const start = Math.floor(span * startFrac);
  const limit = Math.floor(span * limitFrac);
  let run = 0;
  if (fromStart) {
    for (let i = start; i < limit; i++) {
      if (colourDist(lineMean(s, i, vertical), ref) > THRESH) {
        if (++run >= RUN) return (i - RUN + 1) / span;
      } else run = 0;
    }
  } else {
    for (let i = span - 1 - start; i > span - 1 - limit; i--) {
      if (colourDist(lineMean(s, i, vertical), ref) > THRESH) {
        if (++run >= RUN) return (i + RUN - 1) / span;
      } else run = 0;
    }
  }
  return null;
}

// Auto-seed the outer (card edge) and inner (art edge) boxes.
// Strategy: the straightened preview is normally full-bleed, so outer defaults
// to the image edge; if a uniform background margin is detected it's pulled in.
// inner is the first border->art colour transition from each (outer) edge.
export function detectBorders(img: HTMLImageElement): { outer: Box; inner: Box } {
  const s = sampler(img);
  if (!s) return { outer: { ...FULL_BOX }, inner: { ...DEFAULT_INNER } };

  // --- Outer: look for a uniform background margin matching the corner colour.
  const corner = s.px(1, 1);
  const bgMatchesCorner = (idx: number, vertical: boolean) =>
    colourDist(lineMean(s, idx, vertical), corner) <= 22;
  const marginFrom = (vertical: boolean, fromStart: boolean): number => {
    const span = vertical ? s.w : s.h;
    const cap = Math.floor(span * 0.18);
    let m = 0;
    for (let k = 0; k < cap; k++) {
      const idx = fromStart ? k : span - 1 - k;
      if (bgMatchesCorner(idx, vertical)) m = k + 1;
      else break;
    }
    return m / span;
  };
  // Only treat as background if the corner area isn't already card (heuristic:
  // a real margin exists on at least the left or top). Small margins are kept.
  const outer: Box = {
    x0: marginFrom(true, true),
    y0: marginFrom(false, true),
    x1: 1 - marginFrom(true, false),
    y1: 1 - marginFrom(false, false),
  };
  if (outer.x1 - outer.x0 < 0.5 || outer.y1 - outer.y0 < 0.5) {
    outer.x0 = 0; outer.y0 = 0; outer.x1 = 1; outer.y1 = 1;
  }

  // --- Inner: sample the border colour just inside each outer edge, then scan
  // inward to the first transition into the artwork.
  const inFromX = outer.x0 + 0.02;
  const inToX = outer.x1 - 0.02;
  const inFromY = outer.y0 + 0.02;
  const inToY = outer.y1 - 0.02;
  const refL = lineMean(s, Math.floor(s.w * inFromX), true);
  const refR = lineMean(s, Math.floor(s.w * inToX), true);
  const refT = lineMean(s, Math.floor(s.h * inFromY), false);
  const refB = lineMean(s, Math.floor(s.h * inToY), false);

  const cap = 0.4;
  const x0 = firstTransition(s, refL, true, true, outer.x0 + 0.02, outer.x0 + cap);
  const x1 = firstTransition(s, refR, true, false, (1 - outer.x1) + 0.02, (1 - outer.x1) + cap);
  const y0 = firstTransition(s, refT, false, true, outer.y0 + 0.02, outer.y0 + cap);
  const y1 = firstTransition(s, refB, false, false, (1 - outer.y1) + 0.02, (1 - outer.y1) + cap);

  const inner: Box = {
    x0: x0 ?? outer.x0 + 0.08,
    y0: y0 ?? outer.y0 + 0.06,
    x1: x1 ?? outer.x1 - 0.08,
    y1: y1 ?? outer.y1 - 0.06,
  };

  // Sanity: inner must sit inside outer with a positive interior.
  if (inner.x1 - inner.x0 < 0.3 || inner.y1 - inner.y0 < 0.3) {
    inner.x0 = outer.x0 + (outer.x1 - outer.x0) * 0.08;
    inner.x1 = outer.x1 - (outer.x1 - outer.x0) * 0.08;
    inner.y0 = outer.y0 + (outer.y1 - outer.y0) * 0.06;
    inner.y1 = outer.y1 - (outer.y1 - outer.y0) * 0.06;
  }
  return { outer, inner };
}
