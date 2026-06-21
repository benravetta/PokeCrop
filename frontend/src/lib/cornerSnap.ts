import type { Point } from "./cropGeometry";

/**
 * Decode an image into a single-channel luminance buffer (Float32, row-major).
 * Used for client-side sub-pixel corner refinement so dropping a crop handle can
 * "snap" onto the nearest real card corner without a server round-trip.
 */
export function loadLuminance(
  src: string,
  width: number,
  height: number
): Promise<Float32Array | null> {
  return new Promise((resolve) => {
    if (width <= 0 || height <= 0) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const { data } = ctx.getImageData(0, 0, width, height);
        const gray = new Float32Array(width * height);
        for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
          gray[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
        }
        resolve(gray);
      } catch {
        // getImageData can throw if the canvas is tainted; fail gracefully.
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

interface RefineOptions {
  /** Half-size of the gradient window, in image pixels. */
  win?: number;
  /** Number of refinement iterations. */
  iterations?: number;
  /** Maximum distance (image px) the point is allowed to move; else we keep the original. */
  maxMove?: number;
}

/** Bilinear luminance sample (clamped to image bounds). */
function sampleL(
  gray: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number
): number {
  if (x < 0) x = 0;
  if (y < 0) y = 0;
  if (x > width - 1) x = width - 1;
  if (y > height - 1) y = height - 1;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, width - 1);
  const y1 = Math.min(y0 + 1, height - 1);
  const fx = x - x0;
  const fy = y - y0;
  const a = gray[y0 * width + x0];
  const b = gray[y0 * width + x1];
  const c = gray[y1 * width + x0];
  const d = gray[y1 * width + x1];
  return (
    a * (1 - fx) * (1 - fy) +
    b * fx * (1 - fy) +
    c * (1 - fx) * fy +
    d * fx * fy
  );
}

/** Gradient magnitude (central difference) at a sub-pixel location. */
function gradMag(
  gray: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number
): number {
  const gx = sampleL(gray, width, height, x + 1, y) - sampleL(gray, width, height, x - 1, y);
  const gy = sampleL(gray, width, height, x, y + 1) - sampleL(gray, width, height, x, y - 1);
  return Math.hypot(gx, gy) * 0.5;
}

interface Line {
  px: number;
  py: number;
  dx: number;
  dy: number;
}

/**
 * Fit the straight card edge running from `corner` toward `toward`.
 *
 * Samples a series of points along the edge — skipping the rounded corner arc
 * near `corner` — and at each one searches perpendicular to the edge for the
 * strongest luminance transition (the card border). A weighted total-least-
 * squares line is fitted through those edge points. Returns null when the edge
 * is too short or too low-contrast to fit reliably.
 */
function fitEdge(
  gray: Float32Array,
  width: number,
  height: number,
  corner: Point,
  toward: Point
): Line | null {
  const len = Math.hypot(toward.x - corner.x, toward.y - corner.y);
  if (len < 24) return null;

  const dx = (toward.x - corner.x) / len;
  const dy = (toward.y - corner.y) / len;
  const nx = -dy;
  const ny = dx;

  // Skip the rounded corner (~3mm on an 88mm card ≈ 3-5% of the edge), then fit
  // along the straight run that follows it.
  const skip = Math.min(Math.max(len * 0.06, 6), 40);
  const spanEnd = Math.min(len * 0.42, len - 4);
  if (spanEnd - skip < 12) return null;

  const search = Math.min(Math.max(len * 0.06, 6), 28);
  const samples = 26;
  const stepT = (spanEnd - skip) / (samples - 1);

  const pts: { x: number; y: number; w: number }[] = [];
  for (let s = 0; s < samples; s++) {
    const t = skip + stepT * s;
    const baseX = corner.x + dx * t;
    const baseY = corner.y + dy * t;
    let best = 0;
    let bestG = 0;
    for (let o = -search; o <= search; o += 1) {
      const g = gradMag(gray, width, height, baseX + nx * o, baseY + ny * o);
      if (g > bestG) {
        bestG = g;
        best = o;
      }
    }
    if (bestG < 6) continue;
    pts.push({ x: baseX + nx * best, y: baseY + ny * best, w: bestG });
  }

  if (pts.length < 6) return null;

  let sw = 0;
  let mx = 0;
  let my = 0;
  for (const p of pts) {
    sw += p.w;
    mx += p.w * p.x;
    my += p.w * p.y;
  }
  if (sw <= 0) return null;
  mx /= sw;
  my /= sw;

  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const p of pts) {
    const ex = p.x - mx;
    const ey = p.y - my;
    sxx += p.w * ex * ex;
    sxy += p.w * ex * ey;
    syy += p.w * ey * ey;
  }
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  return { px: mx, py: my, dx: Math.cos(theta), dy: Math.sin(theta) };
}

function intersectLines(a: Line, b: Line): Point | null {
  const denom = a.dx * b.dy - a.dy * b.dx;
  if (Math.abs(denom) < 1e-4) return null;
  const t = ((b.px - a.px) * b.dy - (b.py - a.py) * b.dx) / denom;
  return { x: a.px + a.dx * t, y: a.py + a.dy * t };
}

interface EdgeSnapOptions {
  /** Maximum distance (image px) the corner may move; else keep the original. */
  maxMove?: number;
}

/**
 * Snap a crop corner onto the card's true (virtual sharp) corner.
 *
 * Trading cards have rounded corners, so the real geometric corner is the point
 * where the two straight edges would meet if extended through the rounded arc.
 * We fit each adjacent edge from its straight section and intersect them. This
 * is the point the rounded-corner output mask is built around, so the crop ends
 * up flush with the card. Falls back to null (caller may try `refineCorner`).
 */
export function snapCornerToCardEdges(
  gray: Float32Array,
  width: number,
  height: number,
  corner: Point,
  prev: Point,
  next: Point,
  options: EdgeSnapOptions = {}
): Point | null {
  const e1 = fitEdge(gray, width, height, corner, prev);
  const e2 = fitEdge(gray, width, height, corner, next);
  if (!e1 || !e2) return null;

  // Reject near-parallel edges (not a real corner).
  const cross = Math.abs(e1.dx * e2.dy - e1.dy * e2.dx);
  if (cross < 0.25) return null;

  const hit = intersectLines(e1, e2);
  if (!hit || !Number.isFinite(hit.x) || !Number.isFinite(hit.y)) return null;

  const shorter = Math.min(
    Math.hypot(prev.x - corner.x, prev.y - corner.y),
    Math.hypot(next.x - corner.x, next.y - corner.y)
  );
  const maxMove = options.maxMove ?? Math.min(Math.max(shorter * 0.14, 18), 70);
  if (Math.hypot(hit.x - corner.x, hit.y - corner.y) > maxMove) return null;
  return hit;
}

/**
 * Sub-pixel corner refinement, equivalent in spirit to OpenCV's `cornerSubPix`.
 *
 * Around the dropped point we solve for the location q that best satisfies
 *   sum_i  G_i G_iᵀ (q − p_i) = 0
 * where G_i is the image gradient at neighbouring pixel p_i. That point is the
 * weighted intersection of the local edges — i.e. the true corner the two card
 * edges converge on. If no strong corner is found nearby we return null and the
 * handle stays exactly where the user dropped it.
 */
export function refineCorner(
  gray: Float32Array,
  width: number,
  height: number,
  start: Point,
  options: RefineOptions = {}
): Point | null {
  const win = options.win ?? Math.round(Math.min(width, height) / 120) + 5;
  const iterations = options.iterations ?? 6;
  const maxMove = options.maxMove ?? Math.max(14, win * 1.6);
  const sigma = win / 1.5;
  const twoSigmaSq = 2 * sigma * sigma;

  const at = (x: number, y: number) => gray[y * width + x];

  let qx = start.x;
  let qy = start.y;

  for (let iter = 0; iter < iterations; iter++) {
    const cx = Math.round(qx);
    const cy = Math.round(qy);
    if (
      cx < win + 1 ||
      cy < win + 1 ||
      cx >= width - win - 1 ||
      cy >= height - win - 1
    ) {
      break;
    }

    let a11 = 0;
    let a12 = 0;
    let a22 = 0;
    let bx = 0;
    let by = 0;

    for (let j = -win; j <= win; j++) {
      const y = cy + j;
      for (let i = -win; i <= win; i++) {
        const x = cx + i;
        const gx = (at(x + 1, y) - at(x - 1, y)) * 0.5;
        const gy = (at(x, y + 1) - at(x, y - 1)) * 0.5;
        const w = Math.exp(-(i * i + j * j) / twoSigmaSq);
        const gxx = gx * gx * w;
        const gxy = gx * gy * w;
        const gyy = gy * gy * w;
        a11 += gxx;
        a12 += gxy;
        a22 += gyy;
        bx += gxx * x + gxy * y;
        by += gxy * x + gyy * y;
      }
    }

    const det = a11 * a22 - a12 * a12;
    // Ill-conditioned: flat region or a single straight edge (no corner) — stop.
    if (Math.abs(det) < 1e-3) break;

    const nx = (a22 * bx - a12 * by) / det;
    const ny = (-a12 * bx + a11 * by) / det;
    if (!Number.isFinite(nx) || !Number.isFinite(ny)) break;

    // Diverging far from the drop point — reject this candidate.
    if (Math.hypot(nx - start.x, ny - start.y) > maxMove * 2) break;

    const step = Math.hypot(nx - qx, ny - qy);
    qx = nx;
    qy = ny;
    if (step < 0.05) break;
  }

  if (Math.hypot(qx - start.x, qy - start.y) > maxMove) return null;
  return { x: qx, y: qy };
}
