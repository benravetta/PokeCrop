// Beckett BGS tier detection from deterministic subgrades.
// Black Label = all four subgrades at 10 (centering 10 requires measured 50/50 front).
// Pristine 10 = all subgrades ≥ 9.5 with a final blended grade of 10.

export type BgsTier = "black_label" | "pristine";

export function detectBgsTier(subs: number[], likelyNum: number): BgsTier | null {
  if (subs.length !== 4 || subs.some((s) => !Number.isFinite(s))) return null;
  if (subs.every((s) => s === 10)) return "black_label";
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
