import type { CardPricing, PriceIdentity } from "./cardPricing.js";
import { cardIdentityFromGradeFields } from "./ebaySold/cardIdentityNormaliser.js";
import { lookupEbaySoldPrices } from "./ebaySold/lookup.js";
import type { EbaySoldValuation } from "./ebaySold/types.js";

export function mapValuationToCardPricing(valuation: EbaySoldValuation): CardPricing | null {
  if (!valuation.sales.length) {
    return {
      currency: "GBP",
      raw: { low: 0, high: 0 },
      graded: [],
      confidence: "low",
      note: "Insufficient verified sales for a reliable valuation.",
      source: "ebay",
      rawSource: "ebay",
      asOf: valuation.searchMetadata.searchedAt.slice(0, 10),
      compCount: 0,
      ebaySold: valuation,
    };
  }

  const prices = valuation.sales.map((s) => s.priceGbp!).filter(Number.isFinite);
  if (!prices.length) {
    return {
      currency: "GBP",
      raw: { low: 0, high: 0 },
      graded: [],
      confidence: "low",
      note: "Insufficient verified sales for a reliable valuation.",
      source: "ebay",
      rawSource: "ebay",
      asOf: valuation.searchMetadata.searchedAt.slice(0, 10),
      compCount: 0,
      ebaySold: valuation,
    };
  }

  const low = valuation.valuation.lowestSoldPriceGbp ?? Math.min(...prices);
  const high = valuation.valuation.highestSoldPriceGbp ?? Math.max(...prices);
  const avg = valuation.valuation.averageSoldPriceGbp;

  const confidence =
    valuation.confidence.level === "high"
      ? "high"
      : valuation.confidence.level === "medium"
        ? "medium"
        : "low";

  const noteParts: string[] = [];
  if (avg != null && valuation.valuation.salesUsed >= 3) {
    noteParts.push(
      `Average of the most recent ${valuation.valuation.salesUsed} verified comparable eBay sales: £${avg.toFixed(2)}`
    );
  } else if (valuation.valuation.limitedAverageLabel) {
    noteParts.push(valuation.valuation.limitedAverageLabel);
  }
  noteParts.push(...valuation.warnings);

  return {
    currency: "GBP",
    raw: { low, high },
    graded: [],
    confidence,
    note: noteParts.join(" "),
    source: "ebay",
    rawSource: "ebay",
    asOf: valuation.searchMetadata.searchedAt.slice(0, 10),
    compCount: valuation.sales.length,
    ebaySold: valuation,
  };
}

/**
 * eBay UK sold-listing lookup via public pages (HTTP + Playwright fallback).
 * No eBay, PriceCharting or other pricing APIs. No LLM price estimation.
 */
export async function estimateMarketPrices(
  identity: PriceIdentity,
  _companyEstimates: unknown,
  _userId: string,
  opts: { timeoutMs?: number } = {}
): Promise<CardPricing | null> {
  const card = cardIdentityFromGradeFields(identity as Record<string, unknown>);
  if (!card) return null;

  const timeoutMs = opts.timeoutMs ?? 60_000;
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const rawValuation = await Promise.race([
      lookupEbaySoldPrices(card, { timeoutMs }),
      new Promise<EbaySoldValuation | null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);

    if (!rawValuation || rawValuation.status === "temporarily_unavailable") {
      return null;
    }

    const pricing = mapValuationToCardPricing(rawValuation);
    if (!pricing) return null;
    return pricing;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
