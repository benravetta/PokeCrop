import type { HistoricalSaleRecord, VerifiedSale } from "../types.js";
import { historicalDedupKey } from "./historicalSaleMatcher.js";
import { extractItemId } from "../ebaySearchQueryBuilder.js";

function directSaleKey(s: VerifiedSale): string | null {
  if (s.ebayItemId) return `ebay:${s.ebayItemId}`;
  if (s.url) {
    const id = extractItemId(s.url);
    if (id) return `ebay:${id}`;
  }
  return null;
}

/** Remove archived records that duplicate a Tier 1 direct sale. */
export function dedupeDirectAndArchived(
  direct: VerifiedSale[],
  archived: VerifiedSale[]
): VerifiedSale[] {
  const directKeys = new Set<string>();
  for (const s of direct) {
    const k = directSaleKey(s);
    if (k) directKeys.add(k);
    directKeys.add(`${s.soldDate}|${s.priceOriginal}|${s.title.toLowerCase().slice(0, 80)}`);
  }

  const out: VerifiedSale[] = [];
  const seenArchived = new Set<string>();

  for (const s of archived) {
    const ebayKey = s.ebayItemId ? `ebay:${s.ebayItemId}` : s.originalEbayUrl ? directSaleKey({ ...s, url: s.originalEbayUrl }) : null;
    if (ebayKey && directKeys.has(ebayKey)) continue;

    const rowKey = `${s.soldDate}|${s.priceOriginal}|${s.title.toLowerCase().slice(0, 80)}`;
    if (directKeys.has(rowKey)) continue;

    const ak = historicalDedupKey({
      sourceName: s.sourceName,
      sourceUrl: s.sourceUrl,
      marketplace: s.marketplace,
      listingTitle: s.title,
      saleDate: s.soldDate,
      soldPriceOriginal: s.priceOriginal,
      currencyOriginal: s.currencyOriginal,
      originalEbayItemId: s.ebayItemId,
      originalEbayUrl: s.originalEbayUrl,
    });
    if (seenArchived.has(ak)) continue;
    seenArchived.add(ak);
    out.push(s);
  }

  return out;
}

export function dedupeArchivedRecords(records: HistoricalSaleRecord[]): HistoricalSaleRecord[] {
  const seen = new Set<string>();
  const out: HistoricalSaleRecord[] = [];
  for (const r of records) {
    const k = historicalDedupKey(r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

export function mergeAndSelectSales(
  direct: VerifiedSale[],
  archived: VerifiedSale[],
  limit = 3
): VerifiedSale[] {
  const filteredArchived = dedupeDirectAndArchived(direct, archived);
  const combined = [...direct, ...filteredArchived];
  return sortSalesPreferDirect(combined).slice(0, limit);
}

export function sortSalesPreferDirect(sales: VerifiedSale[]): VerifiedSale[] {
  return [...sales].sort((a, b) => {
    const d = b.soldDate.localeCompare(a.soldDate);
    if (d !== 0) return d;
    if (a.evidenceLevel === "direct" && b.evidenceLevel === "archived") return -1;
    if (a.evidenceLevel === "archived" && b.evidenceLevel === "direct") return 1;
    return 0;
  });
}
