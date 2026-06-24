import type { VerifiedSale } from "./types.js";
import type { PriceStats } from "./soldPriceCalculator.js";

export interface ConfidenceResult {
  score: number;
  level: "high" | "medium" | "low";
  reasons: string[];
}

function maxConfidenceCap(stats: PriceStats): number {
  const d = stats.directSalesCount;
  const a = stats.archivedSalesCount;
  const total = stats.salesUsed;

  if (total >= 3 && d === 3) return 100;
  if (total >= 3 && d === 2 && a === 1) return 90;
  if (total >= 3 && d === 1 && a === 2) return 80;
  if (total >= 3 && a === 3) return 70;
  if (total === 2) return 60;
  if (total === 1) return 45;
  return 30;
}

export function calculateValuationConfidence(
  sales: VerifiedSale[],
  stats: PriceStats,
  opts: {
    staleFx: boolean;
    partialDates: boolean;
    accessoryListings: number;
    archivedMissingCardNumber: number;
    archivedMissingEbayId: number;
    unclearArchivedTitles: number;
    inferredCurrency: number;
  }
): ConfidenceResult {
  let score = maxConfidenceCap(stats);
  const reasons: string[] = [];

  for (const s of sales) {
    if (s.evidenceLevel === "archived") {
      score -= 10;
      reasons.push("Includes archived sale record(s)");
    }
  }

  for (const s of sales) {
    if (s.conditionNormalised === "unspecified" && s.evidenceLevel === "direct") {
      score -= 15;
      reasons.push("A listing is missing verified condition");
      break;
    }
  }

  if (stats.salesUsed < 3) {
    reasons.push(`Only ${stats.salesUsed} reliable comparable sale(s) available`);
  }

  if (opts.partialDates) {
    score -= 20;
    reasons.push("A sale date was only partially verified");
  }

  if (opts.staleFx) {
    score -= 30;
    reasons.push("Currency conversion data is stale");
  }

  if (opts.accessoryListings > 0) {
    score -= 15 * opts.accessoryListings;
    reasons.push("A listing may include a negligible accessory");
  }

  if (stats.percentageSpread != null && stats.percentageSpread > 50) {
    score -= 10;
    reasons.push("Unusually large price spread between sales");
  } else if (stats.percentageSpread != null && stats.percentageSpread > 40) {
    score -= 10;
    reasons.push("Large price spread between sales");
  }

  const conditions = new Set(
    sales.map((s) => s.conditionNormalised).filter((c) => c !== "unspecified")
  );
  if (conditions.size > 1) {
    score -= 10;
    reasons.push("Condition varies between included sales");
  }

  score -= opts.archivedMissingCardNumber * 15;
  if (opts.archivedMissingCardNumber) reasons.push("An archived title omits the card number");

  score -= opts.archivedMissingEbayId * 15;
  if (opts.archivedMissingEbayId) reasons.push("Original eBay item ID unavailable for an archived sale");

  score -= opts.unclearArchivedTitles * 20;
  if (opts.unclearArchivedTitles) reasons.push("Unclear wording in an archived listing title");

  score -= opts.inferredCurrency * 25;
  if (opts.inferredCurrency) reasons.push("Sale currency had to be inferred");

  score = Math.max(0, Math.min(maxConfidenceCap(stats), score));

  let level: ConfidenceResult["level"] = "high";
  if (score < 50) level = "low";
  else if (score < 75) level = "medium";

  return { score, level, reasons: [...new Set(reasons)] };
}
