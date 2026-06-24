/** Fetch public marketplace HTML (not developer APIs) for grounding AI price research. */

import type { CardMatchParts } from "./marketMatch.js";
import { listingMatchesCard } from "./marketMatch.js";

const UA =
  "Mozilla/5.0 (compatible; GemCheck/1.0; +https://gemcheck.co.uk) AppleWebKit/537.36";

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&pound;/g, "£")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchPageText(url: string, maxChars = 12_000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      signal: AbortSignal.timeout(12_000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const html = await res.text();
    return stripHtml(html).slice(0, maxChars);
  } catch {
    return null;
  }
}

function buildQuery(parts: CardMatchParts & { graded?: { company: string; grade: string } }): string {
  return [parts.name, parts.set, parts.number ? `#${parts.number}` : "", parts.graded?.company, parts.graded?.grade]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

function ebaySoldUrl(query: string): string {
  const params = new URLSearchParams({
    _nkw: query,
    LH_Sold: "1",
    LH_Complete: "1",
    _sacat: "183454",
    _ipg: "60",
  });
  return `https://www.ebay.co.uk/sch/i.html?${params}`;
}

function priceChartingUrl(query: string): string {
  return `https://www.pricecharting.com/search-products?q=${encodeURIComponent(query)}&type=prices`;
}

/** Pull listing title/price lines from eBay sold-search HTML when accessible. */
function parseEbayListingLines(html: string, parts: CardMatchParts): string[] {
  const lines: string[] = [];
  const titleRe =
    /class="[^"]*s-item__title[^"]*"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>[\s\S]*?class="[^"]*s-item__price[^"]*"[^>]*>([^<]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = titleRe.exec(html)) !== null) {
    const title = m[1]?.replace(/\s+/g, " ").trim();
    const price = m[2]?.replace(/\s+/g, " ").trim();
    if (!title || !price || /shop on ebay/i.test(title)) continue;
    if (!listingMatchesCard(title, parts)) continue;
    lines.push(`${title} — ${price}`);
    if (lines.length >= 25) break;
  }
  return lines;
}

export interface PublicMarketSnippets {
  ebaySoldLines: string[];
  ebayPageText: string | null;
  priceChartingText: string | null;
}

/** Best-effort public page fetch — supplements AI web search, not a substitute. */
export async function fetchPublicMarketSnippets(
  parts: CardMatchParts
): Promise<PublicMarketSnippets> {
  const rawQuery = buildQuery(parts);
  const ebayUrl = ebaySoldUrl(rawQuery);
  const pcUrl = priceChartingUrl(rawQuery);

  let ebayHtml = "";
  try {
    const res = await fetch(ebayUrl, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      signal: AbortSignal.timeout(12_000),
      redirect: "follow",
    });
    if (res.ok) ebayHtml = await res.text();
  } catch {
    /* ignore */
  }

  const ebaySoldLines = ebayHtml ? parseEbayListingLines(ebayHtml, parts) : [];
  const ebayPageText = ebayHtml ? stripHtml(ebayHtml).slice(0, 10_000) : null;

  const [pcText] = await Promise.all([fetchPageText(pcUrl, 8000)]);

  return {
    ebaySoldLines,
    ebayPageText,
    priceChartingText: pcText,
  };
}

export function formatSnippetsForPrompt(snippets: PublicMarketSnippets): string {
  const chunks: string[] = [];
  if (snippets.ebaySoldLines.length) {
    chunks.push(
      "eBay UK sold listing lines (parsed from public search page):\n" +
        snippets.ebaySoldLines.map((l) => `- ${l}`).join("\n")
    );
  } else if (snippets.ebayPageText) {
    chunks.push("eBay UK sold search page text (excerpt):\n" + snippets.ebayPageText.slice(0, 4000));
  }
  if (snippets.priceChartingText) {
    chunks.push("PriceCharting search page text (excerpt):\n" + snippets.priceChartingText.slice(0, 3000));
  }
  return chunks.join("\n\n") || "(No public page snippets retrieved.)";
}
