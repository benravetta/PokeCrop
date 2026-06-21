// Centering measurement for the AI Pre-Grader.
//
// Centering is a pure geometric measurement: the width of each border (the gap
// between the card edge and where the printed design begins). The ratio for an
// axis is `larger / (left + right) * 100`, written larger-side-first (e.g.
// "55/45"). The worst of the two axes sets the centering ceiling.
//
// We work on a STRAIGHTENED card image whose pixel edges are the card edges, so
// the inner box (the printed-design boundary) directly gives the four borders.

// Inner-design box, as fractions (0..1) of the card width/height.
export interface InnerBox {
  x0: number; // left edge of the printed design
  y0: number; // top edge
  x1: number; // right edge
  y1: number; // bottom edge
}

export interface AxisRatio {
  // Larger-side-first ratio string, e.g. "55/45".
  ratio: string;
  // Larger side's percentage (50..100).
  larger: number;
}

export interface CenteringResult {
  leftRight: AxisRatio;
  topBottom: AxisRatio;
}

export type CardSide = "front" | "back";

const DEFAULT_BOX: InnerBox = { x0: 0.08, y0: 0.08, x1: 0.92, y1: 0.92 };

function axisRatio(a: number, b: number): AxisRatio {
  const total = a + b;
  if (total <= 0) return { ratio: "50/50", larger: 50 };
  const largerPct = Math.round((Math.max(a, b) / total) * 100);
  return { ratio: `${largerPct}/${100 - largerPct}`, larger: largerPct };
}

// Compute L/R and T/B ratios from an inner box (fractions). Border widths:
// left = x0, right = 1 - x1, top = y0, bottom = 1 - y1.
export function ratiosFromBox(box: InnerBox): CenteringResult {
  return {
    leftRight: axisRatio(box.x0, 1 - box.x1),
    topBottom: axisRatio(box.y0, 1 - box.y1),
  };
}

// PSA centering tolerances (max larger-side % allowed for each grade).
const FRONT_TIERS: [number, number][] = [
  [55, 10],
  [60, 9],
  [65, 8],
  [70, 7],
  [75, 6],
];
const BACK_TIERS: [number, number][] = [
  [75, 10],
  [80, 9],
  [85, 8],
  [90, 7],
];

// Highest PSA grade the given (worst-axis) centering still allows.
export function centeringCeiling(result: CenteringResult, side: CardSide): number {
  const worst = Math.max(result.leftRight.larger, result.topBottom.larger);
  const tiers = side === "front" ? FRONT_TIERS : BACK_TIERS;
  for (const [maxPct, grade] of tiers) {
    if (worst <= maxPct) return grade;
  }
  return side === "front" ? 5 : 6;
}

export function ceilingLabel(grade: number): string {
  if (grade >= 10) return "PSA 10 centering";
  return `Caps centering at PSA ${grade}`;
}

// Euclidean distance between two RGB triplets (0..441).
function colourDist(a: number[], b: number[]): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

// Auto-detect the inner printed-design box by walking inward from each edge
// until the column/row colour deviates from the border colour sampled at the
// edge. Best-effort: works well on cards with a solid border; the user can
// always fine-tune the box afterwards.
export function detectInnerBox(img: HTMLImageElement): InnerBox {
  const MAX = 480;
  const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { ...DEFAULT_BOX };
  ctx.drawImage(img, 0, 0, w, h);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return { ...DEFAULT_BOX };
  }

  const px = (x: number, y: number): number[] => {
    const i = (y * w + x) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };

  // Mean colour of a column over its central 60% (avoids rounded corners).
  const colMean = (x: number): number[] => {
    const y0 = Math.floor(h * 0.2);
    const y1 = Math.ceil(h * 0.8);
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = y0; y < y1; y += 2) {
      const c = px(x, y);
      r += c[0]; g += c[1]; b += c[2]; n++;
    }
    return n ? [r / n, g / n, b / n] : [0, 0, 0];
  };
  const rowMean = (y: number): number[] => {
    const x0 = Math.floor(w * 0.2);
    const x1 = Math.ceil(w * 0.8);
    let r = 0, g = 0, b = 0, n = 0;
    for (let x = x0; x < x1; x += 2) {
      const c = px(x, y);
      r += c[0]; g += c[1]; b += c[2]; n++;
    }
    return n ? [r / n, g / n, b / n] : [0, 0, 0];
  };

  const THRESH = 42; // colour distance that marks the border->design transition
  const RUN = 3; // consecutive lines required to confirm

  // Walk in from one edge; return the fraction (0..1) where the design begins.
  const scan = (
    limitFrac: number,
    fromStart: boolean,
    size: number,
    mean: (i: number) => number[]
  ): number => {
    const ref = mean(fromStart ? 1 : size - 2);
    const limit = Math.floor(size * limitFrac);
    let run = 0;
    if (fromStart) {
      for (let i = 2; i < limit; i++) {
        if (colourDist(mean(i), ref) > THRESH) {
          if (++run >= RUN) return (i - RUN + 1) / size;
        } else run = 0;
      }
    } else {
      for (let i = size - 3; i > size - limit; i--) {
        if (colourDist(mean(i), ref) > THRESH) {
          if (++run >= RUN) return (i + RUN - 1) / size;
        } else run = 0;
      }
    }
    return fromStart ? limitFrac : 1 - limitFrac;
  };

  // Don't let auto-detect claim more than ~30% as border on any side.
  const box: InnerBox = {
    x0: scan(0.3, true, w, colMean),
    x1: scan(0.3, false, w, colMean),
    y0: scan(0.3, true, h, rowMean),
    y1: scan(0.3, false, h, rowMean),
  };

  // Sanity: ensure a positive interior; fall back to default if detection
  // collapsed (e.g. borderless / full-art card).
  if (box.x1 - box.x0 < 0.3 || box.y1 - box.y0 < 0.3) return { ...DEFAULT_BOX };
  return box;
}
