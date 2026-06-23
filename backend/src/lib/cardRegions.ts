// Normalised card regions for defect snapshot crops (mirrors frontend cardRegions.ts).

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const CORNER = 0.3;
const EDGE = 0.18;
const EDGE_INSET = 0.15;
const CELL = 0.4;

function cell(cx: number, cy: number): Rect {
  return { x: cx - CELL / 2, y: cy - CELL / 2, w: CELL, h: CELL };
}
const T = 1 / 6;
const M = 1 / 2;
const B = 5 / 6;

const REGION_RECTS: Record<string, Rect> = {
  top_left_corner: { x: 0, y: 0, w: CORNER, h: CORNER },
  top_right_corner: { x: 1 - CORNER, y: 0, w: CORNER, h: CORNER },
  bottom_left_corner: { x: 0, y: 1 - CORNER, w: CORNER, h: CORNER },
  bottom_right_corner: { x: 1 - CORNER, y: 1 - CORNER, w: CORNER, h: CORNER },
  top_edge: { x: EDGE_INSET, y: 0, w: 1 - 2 * EDGE_INSET, h: EDGE },
  bottom_edge: { x: EDGE_INSET, y: 1 - EDGE, w: 1 - 2 * EDGE_INSET, h: EDGE },
  left_edge: { x: 0, y: EDGE_INSET, w: EDGE, h: 1 - 2 * EDGE_INSET },
  right_edge: { x: 1 - EDGE, y: EDGE_INSET, w: EDGE, h: 1 - 2 * EDGE_INSET },
  top_left: cell(T, T),
  top_center: cell(M, T),
  top_right: cell(B, T),
  center_left: cell(T, M),
  center: cell(M, M),
  center_right: cell(B, M),
  bottom_left: cell(T, B),
  bottom_center: cell(M, B),
  bottom_right: cell(B, B),
  holo_area: { x: 0.18, y: 0.22, w: 0.64, h: 0.56 },
  full: { x: 0, y: 0, w: 1, h: 1 },
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function clampRect(r: Rect): Rect {
  const x = clamp01(r.x);
  const y = clamp01(r.y);
  return { x, y, w: clamp01(r.w + r.x) - x || Math.min(r.w, 1 - x), h: clamp01(r.h + r.y) - y };
}

export function regionRect(region: string): Rect {
  return REGION_RECTS[region] ?? REGION_RECTS.full;
}

function center(r: Rect): [number, number] {
  return [r.x + r.w / 2, r.y + r.h / 2];
}

function contains(outer: Rect, px: number, py: number): boolean {
  return px >= outer.x && px <= outer.x + outer.w && py >= outer.y && py <= outer.y + outer.h;
}

export function resolveRect(region: string, bbox: number[] | null | undefined): Rect {
  const base = regionRect(region);
  if (bbox && bbox.length === 4 && bbox[2] > 0 && bbox[3] > 0) {
    const b: Rect = { x: bbox[0], y: bbox[1], w: bbox[2], h: bbox[3] };
    const [cx, cy] = center(b);
    if (contains(base, cx, cy)) {
      const pad = 0.05;
      const minSize = 0.16;
      let w = Math.max(b.w + pad * 2, minSize);
      let h = Math.max(b.h + pad * 2, minSize);
      const size = Math.min(Math.max(w, h), 0.9);
      w = h = size;
      return clampRect({ x: cx - w / 2, y: cy - h / 2, w, h });
    }
  }
  return clampRect(base);
}
