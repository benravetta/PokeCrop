// Beckett BGS tier detection from deterministic subgrades.
// Black Label = all four subgrades at 10 AND measured front 50/50 on both axes.
// Pristine 10 = all subgrades ≥ 9.5 with a final blended grade of 10.

import type { CenteringRatios } from "./centeringRatios.js";

export type BgsTier = "black_label" | "pristine";

/** Black Label requires measured perfect front centering (exact 50/50 both axes). */
export function isBgsBlackLabelCentering(ratios?: CenteringRatios | null): boolean {
  if (!ratios?.frontLR || !ratios?.frontTB) return false;
  return ratios.frontLR === "50/50" && ratios.frontTB === "50/50";
}

export function detectBgsTier(
  subs: number[],
  likelyNum: number,
  ratios?: CenteringRatios | null
): BgsTier | null {
  if (subs.length !== 4 || subs.some((s) => !Number.isFinite(s))) return null;
  if (subs.every((s) => s === 10)) {
    if (!isBgsBlackLabelCentering(ratios)) return null;
    return "black_label";
  }
  if (!subs.every((s) => s >= 9.5)) return null;
  const likelyHalf = Math.round(likelyNum * 2) / 2;
  if (likelyHalf >= 10) return "pristine";
  return null;
}

export function bgsTierLabel(tier: BgsTier): string {
  return tier === "black_label" ? "Black Label" : "Pristine";
}

export function formatBgsLikely(likelyNum: number, tier: BgsTier | null, fmt: (v: number) => string): string {
  const base = fmt(likelyNum);
  if (tier === "black_label") return `${base} Black Label`;
  if (tier === "pristine") return `${base} Pristine`;
  return base;
}
