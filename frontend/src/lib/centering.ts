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
    autoOuter?: Box | null;
    autoInner?: Box | null;
    heuristics?: MeasurementHeuristics;
  } = {}
): SideMeasurementMeta {
  const inferred = inferMeasurementHeuristics(outer, inner, opts.autoOuter, opts.autoInner);
  const heuristics = { ...inferred, ...opts.heuristics };
  const adjustmentDelta =
    opts.userAdjustmentDelta ??
    (opts.autoOuter && opts.autoInner
      ? boxAdjustmentDelta(opts.autoOuter, opts.autoInner, outer, inner)
      : undefined);
  const confidence = computeMeasurementConfidence({
    autoDetectOk: opts.autoDetectOk ?? true,
    outer,
    inner,
    imageLongEdge: opts.imageLongEdge,
    userAdjustmentDelta: adjustmentDelta,
    heuristics,
  });
  let detectionQuality: "good" | "fair" | "poor" = "good";
  if (confidence < 0.55) detectionQuality = "poor";
  else if (confidence < 0.75) detectionQuality = "fair";
  return {
    borderWidths: borderWidthsWithMm(outer, inner),
    measurement_confidence: Math.round(confidence * 100) / 100,
    detectionQuality,
    ...heuristics,
    userAdjustmentDelta: adjustmentDelta,
  };
}

/** Mean edge delta between auto-detected and user-adjusted boxes (0..1 scale). */
export function boxAdjustmentDelta(
  autoOuter: Box,
  autoInner: Box,
  outer: Box,
  inner: Box
): number {
  const d =
    (Math.abs(autoOuter.x0 - outer.x0) +
      Math.abs(autoOuter.x1 - outer.x1) +
      Math.abs(autoOuter.y0 - outer.y0) +
      Math.abs(autoOuter.y1 - outer.y1) +
      Math.abs(autoInner.x0 - inner.x0) +
      Math.abs(autoInner.x1 - inner.x1) +
      Math.abs(autoInner.y0 - inner.y0) +
      Math.abs(autoInner.y1 - inner.y1)) /
    8;
  return Math.round(d * 1000) / 1000;
}

/** Heuristic flags from border geometry (no image ML). */
export function inferMeasurementHeuristics(
  outer: Box,
  inner: Box,
  autoOuter?: Box | null,
  autoInner?: Box | null
): MeasurementHeuristics {
  const w = borderWidths(outer, inner);
  const minBorder = Math.min(w.left, w.right, w.top, w.bottom);
  const maxBorder = Math.max(w.left, w.right, w.top, w.bottom);
  const sumLR = w.left + w.right;
  const sumTB = w.top + w.bottom;
  const lrImbalance =
    sumLR > 0 ? Math.abs(w.left - w.right) / sumLR : 0;

  const heuristics: MeasurementHeuristics = {};

  if (minBorder < 0.008 && maxBorder < 0.028) {
    heuristics.borderlessDesign = true;
  }

  if (minBorder < 0.012 && maxBorder > minBorder * 3.5) {
    heuristics.lowContrastBorder = true;
  }

  if (lrImbalance > 0.38 && sumLR > sumTB * 1.6) {
    heuristics.sleeveSuspected = true;
  }

  if (outer.x0 > 0.035 && outer.x1 < 0.965 && lrImbalance > 0.3) {
    heuristics.sleeveSuspected = true;
  }

  const outerAspect = (outer.x1 - outer.x0) / Math.max(0.001, outer.y1 - outer.y0);
  const innerAspect = (inner.x1 - inner.x0) / Math.max(0.001, inner.y1 - inner.y0);
  if (Math.abs(outerAspect - innerAspect) > 0.07) {
    heuristics.perspectiveWarning = true;
  }

  if (autoOuter && autoInner) {
    const outerShift = boxAdjustmentDelta(autoOuter, autoInner, outer, inner);
    if (outerShift > 0.12 && lrImbalance > 0.25) {
      heuristics.perspectiveWarning = true;
    }
  }

  return heuristics;
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
  fullOpaque: Box | null;
  px: (x: number, y: number) => number[];
  alpha: (x: number, y: number) => number;
}

function opaqueBoundsFromAlpha(
  w: number,
  h: number,
  alphaAt: (x: number, y: number) => number,
  thresh = 8,
): Box | null {
  const THRESH = thresh;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (alphaAt(x, y) >= THRESH) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return null;
  return {
    x0: minX / w,
    y0: minY / h,
    x1: (maxX + 1) / w,
    y1: (maxY + 1) / h,
  };
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

  // Opaque bounds at native resolution — bilinear downscale bleeds alpha at edges.
  let fullOpaque: Box | null = null;
  const bw = img.naturalWidth;
  const bh = img.naturalHeight;
  const boundsCanvas = document.createElement("canvas");
  boundsCanvas.width = bw;
  boundsCanvas.height = bh;
  const bctx = boundsCanvas.getContext("2d", { willReadFrequently: true });
  if (bctx) {
    bctx.drawImage(img, 0, 0);
    try {
      const fullData = bctx.getImageData(0, 0, bw, bh).data;
      fullOpaque = opaqueBoundsFromAlpha(bw, bh, (x, y) => fullData[(y * bw + x) * 4 + 3]);
    } catch {
      fullOpaque = null;
    }
  }

  return {
    w,
    h,
    fullOpaque,
    px: (x, y) => {
      const i = (y * w + x) * 4;
      return [data[i], data[i + 1], data[i + 2]];
    },
    alpha: (x, y) => data[(y * w + x) * 4 + 3],
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

function saturation(c: number[]): number {
  return Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]);
}

function meanColor(samples: number[][]): number[] {
  if (!samples.length) return [0, 0, 0];
  let r = 0, g = 0, b = 0;
  for (const c of samples) {
    r += c[0]; g += c[1]; b += c[2];
  }
  const n = samples.length;
  return [r / n, g / n, b / n];
}

type CardEdge = "left" | "right" | "top" | "bottom";

/** Sample the printed border strip along one outer edge (not the card interior). */
function edgeStripSamples(s: Sampler, outer: Box, edge: CardEdge): number[][] {
  const stripFrac = 0.035;
  const cornerSkip = 0.16;
  const cw = outer.x1 - outer.x0;
  const ch = outer.y1 - outer.y0;
  const samples: number[][] = [];
  const px = (x: number, y: number) => s.px(Math.max(0, Math.min(s.w - 1, x)), Math.max(0, Math.min(s.h - 1, y)));

  if (edge === "left") {
    const x0 = Math.floor(s.w * outer.x0);
    const x1 = Math.floor(s.w * (outer.x0 + stripFrac * cw));
    const y0 = Math.floor(s.h * (outer.y0 + ch * cornerSkip));
    const y1 = Math.floor(s.h * (outer.y1 - ch * cornerSkip));
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y < y1; y += 2) samples.push(px(x, y));
    }
  } else if (edge === "right") {
    const x1 = Math.floor(s.w * outer.x1);
    const x0 = Math.floor(s.w * (outer.x1 - stripFrac * cw));
    const y0 = Math.floor(s.h * (outer.y0 + ch * cornerSkip));
    const y1 = Math.floor(s.h * (outer.y1 - ch * cornerSkip));
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y < y1; y += 2) samples.push(px(x, y));
    }
  } else if (edge === "top") {
    const y0 = Math.floor(s.h * outer.y0);
    const y1 = Math.floor(s.h * (outer.y0 + stripFrac * ch));
    const x0 = Math.floor(s.w * (outer.x0 + cw * cornerSkip));
    const x1 = Math.floor(s.w * (outer.x1 - cw * cornerSkip));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x < x1; x += 2) samples.push(px(x, y));
    }
  } else {
    const y1 = Math.floor(s.h * outer.y1);
    const y0 = Math.floor(s.h * (outer.y1 - stripFrac * ch));
    const x0 = Math.floor(s.w * (outer.x0 + cw * cornerSkip));
    const x1 = Math.floor(s.w * (outer.x1 - cw * cornerSkip));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x < x1; x += 2) samples.push(px(x, y));
    }
  }
  return samples;
}

function isBorderLike(c: number[], ref: number[]): boolean {
  const d = colourDist(c, ref);
  if (d <= 28) return true;
  return d <= 44 && saturation(c) <= 62 && saturation(ref) <= 62;
}

/** Mean colour of a scan line across the card interior band (corners skipped). */
function bandMean(s: Sampler, outer: Box, edge: CardEdge, idx: number): number[] {
  const cornerSkip = 0.18;
  const cw = outer.x1 - outer.x0;
  const ch = outer.y1 - outer.y0;
  let r = 0, g = 0, b = 0, n = 0;
  if (edge === "left" || edge === "right") {
    const y0 = Math.floor(s.h * (outer.y0 + ch * cornerSkip));
    const y1 = Math.floor(s.h * (outer.y1 - ch * cornerSkip));
    for (let y = y0; y < y1; y += 2) {
      const c = s.px(idx, y);
      r += c[0]; g += c[1]; b += c[2]; n++;
    }
  } else {
    const x0 = Math.floor(s.w * (outer.x0 + cw * cornerSkip));
    const x1 = Math.floor(s.w * (outer.x1 - cw * cornerSkip));
    for (let x = x0; x < x1; x += 2) {
      const c = s.px(x, idx);
      r += c[0]; g += c[1]; b += c[2]; n++;
    }
  }
  return n ? [r / n, g / n, b / n] : [0, 0, 0];
}

function scanInnerEdge(s: Sampler, outer: Box, edge: CardEdge, borderRef: number[]): number {
  const RUN = 2;
  const maxScan = 0.14;
  const cw = outer.x1 - outer.x0;
  const ch = outer.y1 - outer.y0;
  let run = 0;

  if (edge === "left") {
    const xStart = Math.ceil(s.w * (outer.x0 + 0.002));
    const xEnd = Math.floor(s.w * (outer.x0 + cw * maxScan));
    for (let x = xStart; x <= xEnd; x++) {
      if (!isBorderLike(bandMean(s, outer, "left", x), borderRef)) {
        if (++run >= RUN) return (x - (RUN - 1)) / s.w;
      } else run = 0;
    }
    return outer.x0 + cw * 0.035;
  }
  if (edge === "right") {
    const xStart = Math.floor(s.w * (outer.x1 - 0.002));
    const xEnd = Math.ceil(s.w * (outer.x1 - cw * maxScan));
    for (let x = xStart; x >= xEnd; x--) {
      if (!isBorderLike(bandMean(s, outer, "right", x), borderRef)) {
        if (++run >= RUN) return (x + (RUN - 1)) / s.w;
      } else run = 0;
    }
    return outer.x1 - cw * 0.035;
  }
  if (edge === "top") {
    const yStart = Math.ceil(s.h * (outer.y0 + 0.002));
    const yEnd = Math.floor(s.h * (outer.y0 + ch * maxScan));
    for (let y = yStart; y <= yEnd; y++) {
      if (!isBorderLike(bandMean(s, outer, "top", y), borderRef)) {
        if (++run >= RUN) return (y - (RUN - 1)) / s.h;
      } else run = 0;
    }
    return outer.y0 + ch * 0.035;
  }
  const yStart = Math.floor(s.h * (outer.y1 - 0.002));
  const yEnd = Math.ceil(s.h * (outer.y1 - ch * maxScan));
  for (let y = yStart; y >= yEnd; y--) {
    if (!isBorderLike(bandMean(s, outer, "bottom", y), borderRef)) {
      if (++run >= RUN) return (y + (RUN - 1)) / s.h;
    } else run = 0;
  }
  return outer.y1 - ch * 0.035;
}

function median(values: number[]): number {
  if (!values.length) return 0.035;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function detectInnerBox(s: Sampler, outer: Box): Box {
  const refs = {
    left: meanColor(edgeStripSamples(s, outer, "left")),
    right: meanColor(edgeStripSamples(s, outer, "right")),
    top: meanColor(edgeStripSamples(s, outer, "top")),
    bottom: meanColor(edgeStripSamples(s, outer, "bottom")),
  };
  const globalRef = meanColor([refs.left, refs.right, refs.top, refs.bottom]);

  let inner: Box = {
    x0: scanInnerEdge(s, outer, "left", refs.left),
    x1: scanInnerEdge(s, outer, "right", refs.right),
    y0: scanInnerEdge(s, outer, "top", refs.top),
    y1: scanInnerEdge(s, outer, "bottom", refs.bottom),
  };

  const cw = outer.x1 - outer.x0;
  const ch = outer.y1 - outer.y0;
  const widths = {
    left: inner.x0 - outer.x0,
    right: outer.x1 - inner.x1,
    top: inner.y0 - outer.y0,
    bottom: outer.y1 - inner.y1,
  };
  const MIN = 0.01;
  const MAX = 0.13;
  const good = (w: number) => w >= MIN && w <= MAX;
  const goodVals = Object.values(widths).filter(good);
  const med = median(goodVals.length ? goodVals : [0.035]);

  if (!good(widths.left)) inner.x0 = outer.x0 + med;
  if (!good(widths.right)) inner.x1 = outer.x1 - med;
  if (!good(widths.top)) inner.y0 = outer.y0 + med;
  if (!good(widths.bottom)) inner.y1 = outer.y1 - med;

  if (!good(widths.right)) inner.x1 = scanInnerEdge(s, outer, "right", globalRef);
  if (!good(outer.x1 - inner.x1)) inner.x1 = outer.x1 - med;

  if (inner.x1 - inner.x0 < 0.3 || inner.y1 - inner.y0 < 0.3) {
    inner.x0 = outer.x0 + cw * 0.035;
    inner.x1 = outer.x1 - cw * 0.035;
    inner.y0 = outer.y0 + ch * 0.035;
    inner.y1 = outer.y1 - ch * 0.035;
  }
  return inner;
}

export function boxFromFrac(f: [number, number, number, number]): Box {
  return { x0: f[0], y0: f[1], x1: f[2], y1: f[3] };
}

function validBox(b: Box): boolean {
  return b.x1 - b.x0 > 0.4 && b.y1 - b.y0 > 0.4 && b.x0 >= 0 && b.y0 >= 0 && b.x1 <= 1 && b.y1 <= 1;
}

// Auto-seed the outer (card edge) and inner (art edge) boxes.
export function detectBorders(
  img: HTMLImageElement,
  outerHint?: Box | null,
): { outer: Box; inner: Box } {
  const s = sampler(img);
  if (!s) return { outer: { ...FULL_BOX }, inner: { ...DEFAULT_INNER } };

  const opaque = s.fullOpaque;
  const opaqueArea =
    opaque == null ? 1 : (opaque.x1 - opaque.x0) * (opaque.y1 - opaque.y0);

  // --- Outer: use pipeline hint when available; otherwise alpha bounds at a low
  // threshold so anti-aliased border pixels are not clipped.
  let outer: Box;
  if (outerHint && validBox(outerHint)) {
    outer = { ...outerHint };
  } else if (opaque != null && opaqueArea < 0.98 && opaque.x1 - opaque.x0 > 0.5 && opaque.y1 - opaque.y0 > 0.5) {
    outer = { ...opaque };
  } else {
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
    outer = {
      x0: marginFrom(true, true),
      y0: marginFrom(false, true),
      x1: 1 - marginFrom(true, false),
      y1: 1 - marginFrom(false, false),
    };
    if (outer.x1 - outer.x0 < 0.5 || outer.y1 - outer.y0 < 0.5) {
      outer.x0 = 0;
      outer.y0 = 0;
      outer.x1 = 1;
      outer.y1 = 1;
    }
  }

  // --- Inner: scan inward from each edge until the border colour ends.
  const inner = detectInnerBox(s, outer);

  return { outer, inner };
}
