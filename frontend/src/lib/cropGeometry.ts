export type Point = { x: number; y: number };
export type CropCorners = [Point, Point, Point, Point];

export const CORNER_LABELS = ["TL", "TR", "BR", "BL"] as const;
export type EdgeId = "top" | "right" | "bottom" | "left";

export function cloneCorners(corners: CropCorners): CropCorners {
  return corners.map((p) => ({ ...p })) as CropCorners;
}

export function moveEdge(
  corners: CropCorners,
  edge: EdgeId,
  dx: number,
  dy: number
): CropCorners {
  const next = cloneCorners(corners);
  switch (edge) {
    case "top":
      next[0].x += dx;
      next[0].y += dy;
      next[1].x += dx;
      next[1].y += dy;
      break;
    case "right":
      next[1].x += dx;
      next[1].y += dy;
      next[2].x += dx;
      next[2].y += dy;
      break;
    case "bottom":
      next[2].x += dx;
      next[2].y += dy;
      next[3].x += dx;
      next[3].y += dy;
      break;
    case "left":
      next[0].x += dx;
      next[0].y += dy;
      next[3].x += dx;
      next[3].y += dy;
      break;
  }
  return next;
}

export function edgeMidpoint(corners: CropCorners, edge: EdgeId): Point {
  switch (edge) {
    case "top":
      return {
        x: (corners[0].x + corners[1].x) / 2,
        y: (corners[0].y + corners[1].y) / 2,
      };
    case "right":
      return {
        x: (corners[1].x + corners[2].x) / 2,
        y: (corners[1].y + corners[2].y) / 2,
      };
    case "bottom":
      return {
        x: (corners[2].x + corners[3].x) / 2,
        y: (corners[2].y + corners[3].y) / 2,
      };
    case "left":
      return {
        x: (corners[0].x + corners[3].x) / 2,
        y: (corners[0].y + corners[3].y) / 2,
      };
  }
}

export function clampCorners(
  corners: CropCorners,
  width: number,
  height: number
): CropCorners {
  return corners.map((p) => ({
    x: Math.max(0, Math.min(width - 1, p.x)),
    y: Math.max(0, Math.min(height - 1, p.y)),
  })) as CropCorners;
}

function cornerArcPoints(
  pPrev: Point,
  pCorner: Point,
  pNext: Point,
  radius: number,
  arcSteps = 10
): Point[] {
  const v1x = pPrev.x - pCorner.x;
  const v1y = pPrev.y - pCorner.y;
  const v2x = pNext.x - pCorner.x;
  const v2y = pNext.y - pCorner.y;
  const l1 = Math.hypot(v1x, v1y);
  const l2 = Math.hypot(v2x, v2y);
  if (l1 < 1 || l2 < 1) return [pCorner];

  const u1x = v1x / l1;
  const u1y = v1y / l1;
  const u2x = v2x / l2;
  const u2y = v2y / l2;
  const inset = Math.min(radius, l1 * 0.45, l2 * 0.45);
  const p1 = { x: pCorner.x + u1x * inset, y: pCorner.y + u1y * inset };
  const p2 = { x: pCorner.x + u2x * inset, y: pCorner.y + u2y * inset };
  let bisX = u1x + u2x;
  let bisY = u1y + u2y;
  const bn = Math.hypot(bisX, bisY);
  if (bn < 1e-3) return [p1, p2];
  bisX /= bn;
  bisY /= bn;
  const cosHalf = Math.max(0.05, Math.min(1, u1x * bisX + u1y * bisY));
  const cx = pCorner.x + (bisX * inset) / cosHalf;
  const cy = pCorner.y + (bisY * inset) / cosHalf;
  const a1 = Math.atan2(p1.y - cy, p1.x - cx);
  let a2 = Math.atan2(p2.y - cy, p2.x - cx);
  if (a2 < a1) a2 += Math.PI * 2;

  const pts: Point[] = [];
  for (let i = 0; i <= arcSteps; i++) {
    const a = a1 + ((a2 - a1) * i) / arcSteps;
    pts.push({ x: cx + inset * Math.cos(a), y: cy + inset * Math.sin(a) });
  }
  return pts;
}

export function roundedCropPath(corners: CropCorners, radius: number): string {
  const short = Math.min(
    Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y),
    Math.hypot(corners[2].x - corners[1].x, corners[2].y - corners[1].y),
    Math.hypot(corners[3].x - corners[2].x, corners[3].y - corners[2].y),
    Math.hypot(corners[0].x - corners[3].x, corners[0].y - corners[3].y)
  );
  const r = Math.max(0, Math.min(radius, short * 0.12));
  if (r < 1.5) {
    return `M ${corners[0].x} ${corners[0].y} L ${corners[1].x} ${corners[1].y} L ${corners[2].x} ${corners[2].y} L ${corners[3].x} ${corners[3].y} Z`;
  }

  const arcs = [
    cornerArcPoints(corners[3], corners[0], corners[1], r),
    cornerArcPoints(corners[0], corners[1], corners[2], r),
    cornerArcPoints(corners[1], corners[2], corners[3], r),
    cornerArcPoints(corners[2], corners[3], corners[0], r),
  ];
  const all = arcs.flat();
  if (all.length === 0) return "";
  let d = `M ${all[0].x} ${all[0].y}`;
  for (let i = 1; i < all.length; i++) {
    d += ` L ${all[i].x} ${all[i].y}`;
  }
  return `${d} Z`;
}

export function toCornerArrays(corners: CropCorners): number[][] {
  return corners.map((p) => [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]);
}

export function fromCornerArrays(raw: number[][]): CropCorners | null {
  if (!Array.isArray(raw) || raw.length !== 4) return null;
  const corners = raw.map((pt) => ({ x: Number(pt[0]), y: Number(pt[1]) }));
  if (corners.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null;
  return corners as CropCorners;
}
