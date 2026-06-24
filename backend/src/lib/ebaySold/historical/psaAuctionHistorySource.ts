import type { CardIdentity } from "../types.js";
import type { HistoricalSaleRecord } from "../types.js";
import type { HistoricalSaleSource, HistoricalFetchResult } from "./archiveSources.js";
import { fetchAllowlistedPage, detectArchiveBlock, parsePrice, parseSoldDate } from "./fetchPublicPage.js";
import { decodeEntities } from "../cardIdentityNormaliser.js";
import { extractItemId } from "../ebaySearchQueryBuilder.js";

function buildPsaSearchUrl(card: CardIdentity): string {
  const q = [card.cardName, card.setName, card.cardNumber, card.grader, card.grade]
    .filter(Boolean)
    .join(" ");
  return `https://www.psacard.com/auctionprices/search?q=${encodeURIComponent(q)}`;
}

/** Parse PSA auction prices realized — eBay marketplace rows only. */
export function parsePsaAuctionRows(html: string, pageUrl: string): HistoricalSaleRecord[] {
  const records: HistoricalSaleRecord[] = [];
  const rowRe = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
  let m: RegExpExecArray | null;

  while ((m = rowRe.exec(html)) !== null) {
    const block = m[0]!;
    const text = decodeEntities(block.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    if (!/ebay/i.test(text)) continue;
    if (/\b(heritage|goldin|pwcc|scp)\b/i.test(text) && !/ebay/i.test(text)) continue;

    const gradeM = text.match(/\bPSA\s*(10|9\.5|9|8\.5|8|7)(?!\d)/i);
    const cellTexts = [...block.matchAll(/>([^<]{4,160})</g)]
      .map((c) => c[1]!.trim())
      .filter((cell) => !/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(cell) && !/^\$|^£/.test(cell) && !/^ebay$/i.test(cell));
    const title =
      cellTexts.find((cell) => /pokemon|pikachu|charizard|\b\d{1,3}\s*\/\s*\d{2,3}\b/i.test(cell)) ??
      cellTexts.sort((a, b) => b.length - a.length)[0] ??
      text;
    if (!title) continue;

    const priceM = text.match(/\$[\d,]+(?:\.\d{2})?|£[\d,]+(?:\.\d{2})?/);
    const price = priceM ? parsePrice(priceM[0]!) : null;
    if (!price) continue;

    const dateM = text.match(/\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}|[A-Za-z]{3}\s+\d{1,2},?\s+\d{4}/);
    const saleDate = dateM ? parseSoldDate(dateM[0]!) : null;
    if (!saleDate) continue;

    const ebayLink = block.match(/href="(https:\/\/(?:www\.)?ebay\.[^"]+)"/i)?.[1];

    records.push({
      sourceName: "PSA Auction Prices",
      sourceUrl: pageUrl,
      marketplace: "eBay",
      listingTitle: title,
      saleDate,
      soldPriceOriginal: price.amount,
      currencyOriginal: price.currency,
      grader: gradeM ? "PSA" : "PSA",
      grade: gradeM?.[1] ?? undefined,
      originalEbayUrl: ebayLink ?? null,
      originalEbayItemId: ebayLink ? extractItemId(ebayLink) : null,
      sourceSaleId: `psa|${saleDate}|${price.amount}|${title.slice(0, 40)}`,
    });
  }

  return records;
}

export const psaAuctionHistorySource: HistoricalSaleSource = {
  name: "PSA Auction Prices",

  supports(card: CardIdentity) {
    return Boolean(
      card.cardName &&
        card.conditionType === "graded" &&
        card.grader &&
        /psa/i.test(card.grader)
    );
  },

  async fetch(card: CardIdentity, opts = {}): Promise<HistoricalFetchResult> {
    const url = buildPsaSearchUrl(card);
    const html = await fetchAllowlistedPage(url, opts.timeoutMs ?? 15_000);
    if (!html) {
      return {
        records: [],
        excluded: [],
        errorCode: "ARCHIVE_SOURCE_UNAVAILABLE",
        errorMessage: "PSA auction history page unavailable",
      };
    }
    if (detectArchiveBlock(html)) {
      return {
        records: [],
        excluded: [],
        errorCode: "ARCHIVE_ACCESS_BLOCKED",
        errorMessage: "PSA access blocked",
      };
    }

    const records = parsePsaAuctionRows(html, url).filter((r) => {
      if (!card.grade) return true;
      const g = r.grade?.replace(/[^\d.]/g, "");
      const want = card.grade.replace(/[^\d.]/g, "");
      return g === want;
    });

    if (!records.length) {
      return {
        records: [],
        excluded: [],
        errorCode: "NO_RELIABLE_HISTORICAL_SALES",
        errorMessage: "No eBay PSA auction records found",
      };
    }

    return { records, excluded: [] };
  },
};
