/** en-GB display labels for API keys and condition areas (keep JSON keys American). */

export const SUBGRADE_KEYS = ["centering", "corners", "edges", "surface"] as const;
export type SubgradeKey = (typeof SUBGRADE_KEYS)[number];

export const SUBGRADE_LABELS: Record<SubgradeKey, string> = {
  centering: "Centring",
  corners: "Corners",
  edges: "Edges",
  surface: "Surface",
};

export function subgradeLabel(key: string): string {
  if (key in SUBGRADE_LABELS) return SUBGRADE_LABELS[key as SubgradeKey];
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export const CENTRING_SECTION_TITLE = "Centring";
