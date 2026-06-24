import type { EvidenceMode, VerifiedSale } from "./types.js";

export interface PriceStats {
  salesUsed: number;
  averageSoldPriceGbp: number | null;
  medianSoldPriceGbp: number | null;
  lowestSoldPriceGbp: number | null;
  highestSoldPriceGbp: number | null;
  priceRangeGbp: number | null;
  percentageSpread: number | null;
  evidenceMode: EvidenceMode;
  directSalesCount: number;
  archivedSalesCount: number;
  limitedAverageLabel?: string;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export function computeEvidenceMode(sales: VerifiedSale[]): EvidenceMode {
  const direct = sales.filter((s) => s.evidenceLevel === "direct").length;
  const archived = sales.filter((s) => s.evidenceLevel === "archived").length;
  if (sales.length < 3) return "insufficient_sales";
  if (direct === 3) return "direct_only";
  if (archived === 3) return "archived_only";
  if (direct > 0 && archived > 0) return "mixed_evidence";
  if (direct > 0) return direct >= 3 ? "direct_only" : "insufficient_sales";
  return "archived_only";
}

export function markOutliers(sales: VerifiedSale[]): VerifiedSale[] {
  const prices = sales.map((s) => s.priceGbp!).filter(Number.isFinite);
  const med = median(prices);
  if (med == null) return sales;

  return sales.map((s) => {
    const p = s.priceGbp!;
    const diff = Math.abs(p - med) / med;
    const conditionSpread = sales.some(
      (o) =>
        o.ebayItemId !== s.ebayItemId &&
        o.conditionNormalised !== s.conditionNormalised &&
        o.conditionNormalised !== "unspecified"
    );
    return {
      ...s,
      possibleOutlier: diff > 0.4 || conditionSpread,
    };
  });
}

export function calculateSoldPriceStats(sales: VerifiedSale[]): PriceStats {
  const withGbp = sales.filter((s) => s.priceGbp != null && Number.isFinite(s.priceGbp));
  const prices = withGbp.map((s) => s.priceGbp!);
  const n = prices.length;
  const directSalesCount = sales.filter((s) => s.evidenceLevel === "direct").length;
  const archivedSalesCount = sales.filter((s) => s.evidenceLevel === "archived").length;
  const evidenceMode = computeEvidenceMode(sales);

  if (n === 0) {
    return {
      salesUsed: 0,
      averageSoldPriceGbp: null,
      medianSoldPriceGbp: null,
      lowestSoldPriceGbp: null,
      highestSoldPriceGbp: null,
      priceRangeGbp: null,
      percentageSpread: null,
      evidenceMode: "insufficient_sales",
      directSalesCount: 0,
      archivedSalesCount: 0,
    };
  }

  const lowest = Math.min(...prices);
  const highest = Math.max(...prices);
  const med = median(prices)!;
  const range = Math.round((highest - lowest) * 100) / 100;

  let average: number | null = null;
  let label: string | undefined;

  if (n >= 3) {
    const top3 = withGbp.slice(0, 3).map((s) => s.priceGbp!);
    average = Math.round(((top3[0]! + top3[1]! + top3[2]!) / 3) * 100) / 100;
  } else if (n === 2) {
    average = Math.round(((prices[0]! + prices[1]!) / 2) * 100) / 100;
    label = "Limited average based on 2 verified sales";
  } else {
    average = prices[0]!;
    label = "Single verified sale — not an average";
  }

  const spread =
    average && average > 0
      ? Math.round(((highest - lowest) / average) * 10000) / 100
      : null;

  return {
    salesUsed: n >= 3 ? 3 : n,
    averageSoldPriceGbp: average,
    medianSoldPriceGbp: Math.round(med * 100) / 100,
    lowestSoldPriceGbp: Math.round(lowest * 100) / 100,
    highestSoldPriceGbp: Math.round(highest * 100) / 100,
    priceRangeGbp: range,
    percentageSpread: spread,
    evidenceMode,
    directSalesCount,
    archivedSalesCount,
    limitedAverageLabel: label,
  };
}

/** Sort by sold date descending; prefer direct on same date. */
export function sortSalesByRecency(sales: VerifiedSale[]): VerifiedSale[] {
  return [...sales].sort((a, b) => {
    const d = b.soldDate.localeCompare(a.soldDate);
    if (d !== 0) return d;
    if (a.evidenceLevel === "direct" && b.evidenceLevel === "archived") return -1;
    if (a.evidenceLevel === "archived" && b.evidenceLevel === "direct") return 1;
    return 0;
  });
}

export function selectTopRecentSales(sales: VerifiedSale[], count = 3): VerifiedSale[] {
  return sortSalesByRecency(sales).slice(0, count);
}
