import type { HistoricalSaleRecord, VerifiedSale } from "../types.js";
import type { NormalisedCardIdentity } from "../types.js";
import { convertToGbp } from "../currencyConverter.js";
import { normaliseCondition } from "../cardListingMatcher.js";
import { validateHistoricalRecord } from "./historicalSaleMatcher.js";
import { extractItemId, sanitiseEbayUrl } from "../ebaySearchQueryBuilder.js";

export function historicalRecordToVerifiedSale(
  record: HistoricalSaleRecord,
  identity: NormalisedCardIdentity,
  matchScore: number
): VerifiedSale | null {
  const conversion = convertToGbp(record.soldPriceOriginal, record.currencyOriginal);
  if (!conversion) return null;

  const ebayId = record.originalEbayItemId ?? (record.originalEbayUrl ? extractItemId(record.originalEbayUrl) : null);
  const originalEbayUrl = record.originalEbayUrl
    ? sanitiseEbayUrl(record.originalEbayUrl)
    : ebayId
      ? `https://www.ebay.co.uk/itm/${ebayId}`
      : null;

  const notes: string[] = [];
  if (!ebayId) notes.push("Original eBay item ID unavailable");
  if (conversion.stale) notes.push("Exchange rate data is stale");
  notes.push(`Recovered from ${record.sourceName} public archive`);

  return {
    ebayItemId: ebayId,
    title: record.listingTitle,
    url: record.sourceUrl,
    soldDate: record.saleDate,
    saleFormat: record.saleFormat ?? "unknown",
    conditionOriginal: record.condition ?? "unspecified",
    conditionNormalised: normaliseCondition(record.condition ?? ""),
    priceOriginal: record.soldPriceOriginal,
    currencyOriginal: record.currencyOriginal,
    exchangeRateToGbp: conversion.rate,
    priceGbp: conversion.gbp,
    matchScore,
    possibleOutlier: false,
    evidenceLevel: "archived",
    verificationStatus: "historically_indexed",
    sourceName: record.sourceName,
    sourceUrl: record.sourceUrl,
    marketplace: record.marketplace,
    originalListingAvailable: false,
    originalEbayUrl,
    verificationNotes: notes,
  };
}

export function normaliseHistoricalRecords(
  records: HistoricalSaleRecord[],
  identity: NormalisedCardIdentity
): { sales: VerifiedSale[]; excluded: Array<{ title: string; url: string; reasonCode: string; reason: string }> } {
  const sales: VerifiedSale[] = [];
  const excluded: Array<{ title: string; url: string; reasonCode: string; reason: string }> = [];

  for (const record of records) {
    const v = validateHistoricalRecord(record, identity);
    if (!v.accepted) {
      excluded.push({
        title: record.listingTitle,
        url: record.sourceUrl,
        reasonCode: v.reasonCode ?? "AMBIGUOUS_ARCHIVED_RECORD",
        reason: v.reason ?? "Rejected archived record",
      });
      continue;
    }
    const sale = historicalRecordToVerifiedSale(record, identity, v.matchScore ?? 85);
    if (sale) sales.push(sale);
    else {
      excluded.push({
        title: record.listingTitle,
        url: record.sourceUrl,
        reasonCode: "CURRENCY_RATE_UNAVAILABLE",
        reason: "Currency conversion unavailable",
      });
    }
  }

  return { sales, excluded };
}
