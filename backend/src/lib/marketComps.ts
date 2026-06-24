/** Shared types and stats for market price comps (no AI guessing). */

export type CompSource = "cardmarket" | "pricecharting" | "ebay" | "ebay_sold";

export interface MarketComp {
  source: CompSource;
  kind: "raw" | "graded";
  priceGbp: number;
  company?: string;
  grade?: string;
  /** Human-readable comp label (product name, listing title, PC grade row). */
  label?: string;
}

export interface PriceBand {
  low: number;
  high: number;
  median: number;
  count: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Trim outliers and return low/median/high from comp prices. */
export function bandFromPrices(prices: number[]): PriceBand | null {
  const clean = prices.filter((p) => Number.isFinite(p) && p > 0).sort((a, b) => a - b);
  if (!clean.length) return null;

  const median =
    clean.length % 2 === 1
      ? clean[(clean.length - 1) / 2]!
      : (clean[clean.length / 2 - 1]! + clean[clean.length / 2]!) / 2;

  const q1 = clean[Math.floor(clean.length * 0.25)] ?? clean[0]!;
  const q3 = clean[Math.floor(clean.length * 0.75)] ?? clean[clean.length - 1]!;
  const iqr = Math.max(q3 - q1, median * 0.05);
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  const trimmed = clean.filter((p) => p >= lo && p <= hi);
  const use = trimmed.length >= 2 ? trimmed : clean;

  const med =
    use.length % 2 === 1
      ? use[(use.length - 1) / 2]!
      : (use[use.length / 2 - 1]! + use[use.length / 2]!) / 2;

  const spread = Math.max(med * 0.08, 0.5);
  return {
    median: round2(med),
    low: round2(Math.min(...use)),
    high: round2(Math.max(...use)),
    count: use.length,
  };
}

export function sourceSummary(sources: Set<string>): string {
  return [...sources].sort().join(" + ");
}
