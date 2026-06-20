// Shared validation/clamping for crop parameters, used by both the interactive
// web flow (routes/process.ts) and the public API (routes/v1.ts) so they behave
// identically.

function parseManualCorners(raw: unknown): number[][] | undefined {
  if (!Array.isArray(raw) || raw.length !== 4) return undefined;
  const corners: number[][] = [];
  for (const pt of raw) {
    if (!Array.isArray(pt) || pt.length !== 2) return undefined;
    const x = Number(pt[0]);
    const y = Number(pt[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
    corners.push([x, y]);
  }
  return corners;
}

export function validateParams(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return defaults();
  const p = raw as Record<string, unknown>;
  const clamp = (v: unknown, min: number, max: number, def: number) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return def;
    return Math.max(min, Math.min(max, n));
  };
  return {
    edge_sensitivity: clamp(p.edge_sensitivity, 0, 1, 0.5),
    contour_threshold: clamp(p.contour_threshold, 0, 1, 0.5),
    crop_padding: Math.round(clamp(p.crop_padding, 0, 100, 0)),
    edge_trim: Math.round(clamp(p.edge_trim, 0, 40, 0)),
    bg_removal: clamp(p.bg_removal, 0, 1, 0),
    top_edge_cleanup: clamp(p.top_edge_cleanup, 0, 1, 0.7),
    corner_radius: clamp(p.corner_radius, 0, 1, 0.5),
    rotate_correction:
      p.rotate_correction !== false && p.rotate_correction !== "false",
    rotation_deg:
      typeof p.rotation_deg === "number" && Number.isFinite(p.rotation_deg)
        ? p.rotation_deg
        : undefined,
    manual_corners: parseManualCorners(p.manual_corners),
  };
}

function defaults(): Record<string, unknown> {
  return validateParams({});
}
