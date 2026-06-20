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
