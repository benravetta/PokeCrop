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

// The manual editor sends a 3x3 homography (row-major, 9 numbers) mapping its
// rectified preview pixels back to the original image, alongside manual_corners.
function parseManualTransform(raw: unknown): number[] | undefined {
  if (!Array.isArray(raw) || raw.length !== 9) return undefined;
  const m = raw.map((v) => Number(v));
  if (m.some((n) => !Number.isFinite(n))) return undefined;
  return m;
}

function parseRoi(raw: unknown): number[] | undefined {
  if (!Array.isArray(raw) || raw.length !== 4) return undefined;
  const box = raw.map((v) => Number(v));
  if (box.some((n) => !Number.isFinite(n))) return undefined;
  return box;
}

function parseBackground(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const s = raw.trim().toLowerCase();
  if (s === "" || s === "none" || s === "transparent") return undefined;
  if (["white", "black", "grey", "gray"].includes(s)) return s;
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  return undefined;
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
    // Active params for the staged pipeline.
    corner_radius: clamp(p.corner_radius, 0, 1, 0.5),
    crop_padding: Math.round(clamp(p.crop_padding, 0, 100, 8)),
    output_rotation: normalizeRotation(p.output_rotation),
    output_size: p.output_size === "high" ? "high" : "standard",
    grading_safe: p.grading_safe === true || p.grading_safe === "true",
    background: parseBackground(p.background),
    roi: parseRoi(p.roi),
    manual_corners: parseManualCorners(p.manual_corners),
    manual_transform: parseManualTransform(p.manual_transform),
    // Legacy knobs kept (ignored by the new pipeline) for API compatibility.
    edge_sensitivity: clamp(p.edge_sensitivity, 0, 1, 0.5),
    contour_threshold: clamp(p.contour_threshold, 0, 1, 0.5),
    edge_trim: Math.round(clamp(p.edge_trim, 0, 40, 0)),
    bg_removal: clamp(p.bg_removal, 0, 1, 0),
    top_edge_cleanup: clamp(p.top_edge_cleanup, 0, 1, 0.7),
    rotate_correction:
      p.rotate_correction !== false && p.rotate_correction !== "false",
    rotation_deg:
      typeof p.rotation_deg === "number" && Number.isFinite(p.rotation_deg)
        ? p.rotation_deg
        : undefined,
  };
}

// Normalise a manual output rotation to one of {0, 90, 180, 270} degrees.
function normalizeRotation(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return (((Math.round(n / 90) * 90) % 360) + 360) % 360;
}

function defaults(): Record<string, unknown> {
  return validateParams({});
}
