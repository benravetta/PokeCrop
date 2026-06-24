import type { CardIdentity } from "../types.js";
import type { HistoricalSaleRecord } from "../types.js";
import type { HistoricalSaleSource, HistoricalFetchResult } from "./archiveSources.js";
import { fetchAllowlistedPage, detectArchiveBlock, parsePrice, parseSoldDate } from "./fetchPublicPage.js";
import { decodeEntities } from "../cardIdentityNormaliser.js";
import { extractItemId } from "../ebaySearchQueryBuilder.js";

function buildProductUrl(card: CardIdentity): string {
  const q = [card.cardName, card.setName, card.cardNumber?.replace("/", "-")]
    .filter(Boolean)
    .join(" ")
    .trim();
  return `https://www.pricecharting.com/search-products?q=${encodeURIComponent(q)}&type=prices`;
}

function buildGameProductUrl(card: CardIdentity): string {
  const slug = [card.setName, card.cardName, card.cardNumber]
    .filter(Boolean)
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `https://www.pricecharting.com/game/pokemon-${slug}`;
}

/** Parse individual sale rows from PriceCharting sale-history HTML. */
export function parsePriceChartingSaleRows(html: string, pageUrl: string): HistoricalSaleRecord[] {
  const records: HistoricalSaleRecord[] = [];

  const rowRe =
    /<tr[^>]*>[\s\S]*?(?:completed|sold)[\s\S]*?<\/tr>/gi;
  const altRe =
    /class="[^"]*sale[^"]*"[^>]*>[\s\S]*?<\/(?:tr|li|div)>/gi;

  const blocks: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html)) !== null) blocks.push(m[0]!);
  if (!blocks.length) {
    while ((m = altRe.exec(html)) !== null) blocks.push(m[0]!);
  }

  for (const block of blocks) {
    const text = decodeEntities(block.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    if (!/ebay/i.test(text)) continue;
    if (/\b(market|average|trend|guide)\b/i.test(text) && !/sold/i.test(text)) continue;

    const titleM =
      block.match(/title="([^"]+)"/i) ??
      block.match(/>([^<]{10,140})</);
    const title = decodeEntities(titleM?.[1] ?? text.slice(0, 140)).trim();
    if (!title || /\b(market value|loose price|graded price)\b/i.test(title)) continue;

    const priceM = text.match(/£[\d,.]+|US \$[\d,.]+|\$[\d,.]+|EUR [\d,.]+/i);
    const price = priceM ? parsePrice(priceM[0]!) : null;
    if (!price) continue;

    const dateM = text.match(
      /(?:sold|completed|ended)\s+(\d{1,2}\s+[A-Za-z]{3}\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4}|[A-Za-z]{3}\s+\d{1,2},?\s+\d{4})/i
    );
    const saleDate = dateM ? parseSoldDate(dateM[0]!) : parseSoldDate(text);
    if (!saleDate) continue;

    const ebayLink = block.match(/href="(https:\/\/(?:www\.)?ebay\.[^"]+)"/i)?.[1];
    const itemId = ebayLink ? extractItemId(ebayLink) : null;

    records.push({
      sourceName: "PriceCharting",
      sourceUrl: pageUrl,
      marketplace: "eBay",
      listingTitle: title,
      saleDate,
      soldPriceOriginal: price.amount,
      currencyOriginal: price.currency,
      originalEbayUrl: ebayLink ?? null,
      originalEbayItemId: itemId,
      sourceSaleId: `pc|${saleDate}|${price.amount}|${title.slice(0, 40)}`,
    });
  }

  return records;
}

export const priceChartingHistoricalSource: HistoricalSaleSource = {
  name: "PriceCharting",

  supports(card: CardIdentity) {
    return Boolean(card.cardName && (card.setName || card.cardNumber));
  },

  async fetch(card: CardIdentity, opts = {}): Promise<HistoricalFetchResult> {
    const urls = [buildProductUrl(card), buildGameProductUrl(card)];
    const excluded: HistoricalFetchResult["excluded"] = [];

    for (const url of urls) {
      const html = await fetchAllowlistedPage(url, opts.timeoutMs ?? 15_000);
      if (!html) continue;
      if (detectArchiveBlock(html)) {
        return {
          records: [],
          excluded,
          errorCode: "ARCHIVE_ACCESS_BLOCKED",
          errorMessage: "PriceCharting access blocked",
        };
      }
      const records = parsePriceChartingSaleRows(html, url);
      if (records.length) return { records, excluded };
    }

    return {
      records: [],
      excluded,
      errorCode: "NO_RELIABLE_HISTORICAL_SALES",
      errorMessage: "No individual sale rows found on PriceCharting",
    };
  },
};
