import type { ListingCandidate, SaleFormat } from "./types.js";
import { extractItemId, sanitiseEbayUrl } from "./ebaySearchQueryBuilder.js";
import { decodeEntities } from "./cardIdentityNormaliser.js";

export interface ParseResult {
  candidates: ListingCandidate[];
  strategy: string;
  blocked: boolean;
  blockReason?: "CAPTCHA_REQUIRED" | "EBAY_ACCESS_BLOCKED" | "PARSING_FAILED";
}

const MAX_HTML_BYTES = 2_000_000;

export function detectAccessBlock(html: string): ParseResult["blockReason"] | null {
  const lower = html.toLowerCase();
  if (/captcha|verify you are a human|robot check|security measure/i.test(lower)) {
    return "CAPTCHA_REQUIRED";
  }
  if (/access denied|http error 403|reference #18/i.test(lower)) {
    return "EBAY_ACCESS_BLOCKED";
  }
  return null;
}

export function parsePrice(text: string): { amount: number; currency: string } | null {
  const s = decodeEntities(text).replace(/\s+/g, " ").trim();
  if (!s || /best offer|see details|not available|free/i.test(s)) return null;

  const gbp = s.match(/£\s*([\d,]+(?:\.\d{1,2})?)/);
  if (gbp) return { amount: Number(gbp[1]!.replace(/,/g, "")), currency: "GBP" };

  const usd = s.match(/(?:US\s*\$|USD\s*)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (usd) return { amount: Number(usd[1]!.replace(/,/g, "")), currency: "USD" };

  if (/^\$/.test(s) && !/^C\s*\$/i.test(s) && !/^AU\s*\$/i.test(s)) {
    const bareUsd = s.match(/^\$\s*([\d,]+(?:\.\d{1,2})?)/);
    if (bareUsd) return { amount: Number(bareUsd[1]!.replace(/,/g, "")), currency: "USD" };
  }

  const eur = s.match(/(?:EUR|€)\s*([\d.,]+)/i);
  if (eur) {
    const n = eur[1]!.includes(",") && eur[1]!.includes(".")
      ? eur[1]!.replace(/\./g, "").replace(",", ".")
      : eur[1]!.replace(",", "");
    return { amount: Number(n), currency: "EUR" };
  }

  const cad = s.match(/C\s*\$\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (cad) return { amount: Number(cad[1]!.replace(/,/g, "")), currency: "CAD" };

  const aud = s.match(/AU\s*\$\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (aud) return { amount: Number(aud[1]!.replace(/,/g, "")), currency: "AUD" };

  const jpy = s.match(/(?:JP¥|JPY|¥)\s*([\d,]+)/i);
  if (jpy) return { amount: Number(jpy[1]!.replace(/,/g, "")), currency: "JPY" };

  return null;
}

export function parseSoldDate(text: string, referenceYear = new Date().getFullYear()): string | null {
  const s = decodeEntities(text).replace(/\s+/g, " ").trim();
  if (!s) return null;

  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmy = s.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (dmy) {
    const y = dmy[3]!.length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${y}-${dmy[2]!.padStart(2, "0")}-${dmy[1]!.padStart(2, "0")}`;
  }

  const months: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };

  const m1 = s.match(/(?:sold|ended)\s+(\d{1,2})\s+([a-z]{3})\s+(\d{4})/i);
  if (m1) {
    const mo = months[m1[2]!.toLowerCase().slice(0, 3)];
    if (mo) return `${m1[3]}-${mo}-${m1[1]!.padStart(2, "0")}`;
  }

  const m2 = s.match(/(?:sold|ended)\s+([a-z]{3})\s+(\d{1,2}),?\s+(\d{4})/i);
  if (m2) {
    const mo = months[m2[1]!.toLowerCase().slice(0, 3)];
    if (mo) return `${m2[3]}-${mo}-${m2[2]!.padStart(2, "0")}`;
  }

  const m3 = s.match(/(?:sold|ended)\s+(\d{1,2})\s+([a-z]{3})/i);
  if (m3) {
    const mo = months[m3[2]!.toLowerCase().slice(0, 3)];
    if (mo) return `${referenceYear}-${mo}-${m3[1]!.padStart(2, "0")}`;
  }

  return null;
}

function inferSaleFormat(text: string): SaleFormat {
  const t = text.toLowerCase();
  if (/best offer accepted|accepted offer/.test(t)) return "best_offer";
  if (/\bauction\b|\bbids\b|\bwinning bid\b/.test(t)) return "auction";
  if (/buy it now|\bbin\b/.test(t)) return "buy_it_now";
  return "unknown";
}

function candidateFromParts(parts: {
  title: string;
  url: string;
  priceText: string;
  dateText: string;
  conditionText: string;
  shippingText: string;
  strategy: string;
}): ListingCandidate | null {
  const itemId = extractItemId(parts.url);
  const url = itemId ? sanitiseEbayUrl(parts.url) : sanitiseEbayUrl(parts.url);
  if (!url || !parts.title.trim()) return null;

  const price = parsePrice(parts.priceText);
  const combined = `${parts.priceText} ${parts.title}`.toLowerCase();
  const bestOfferDetected = /best offer|accepted offer|or best offer/i.test(combined);
  const bestOfferUnverified =
    bestOfferDetected &&
    !/best offer accepted|accepted offer/i.test(combined) &&
    /or best offer|best offer/i.test(combined);

  const soldDate = parseSoldDate(parts.dateText || parts.title);

  return {
    listingTitle: decodeEntities(parts.title).trim(),
    listingUrl: url,
    itemId: itemId ?? extractItemId(url) ?? "",
    displayedPrice: parts.priceText.trim(),
    parsedPrice: price?.amount ?? null,
    currency: price?.currency ?? "",
    soldDateText: parts.dateText.trim(),
    soldDate,
    condition: decodeEntities(parts.conditionText).trim(),
    shippingText: parts.shippingText.trim(),
    saleFormat: inferSaleFormat(combined),
    bestOfferDetected,
    bestOfferUnverified,
    soldEvidence: /sold|ended/i.test(`${parts.dateText} ${parts.title} ${parts.priceText}`),
    parserStrategy: parts.strategy,
  };
}

/** Strategy 1: JSON-LD Product/Offer blocks */
function parseJsonLd(html: string): ListingCandidate[] {
  const out: ListingCandidate[] = [];
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1]!) as Record<string, unknown>;
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        const name = String(item.name ?? "");
        const url = String(item.url ?? "");
        const offers = item.offers as Record<string, unknown> | undefined;
        const price = String(offers?.price ?? offers?.lowPrice ?? "");
        const currency = String(offers?.priceCurrency ?? "GBP");
        if (!name || !url.includes("ebay")) continue;
        const c = candidateFromParts({
          title: name,
          url,
          priceText: currency === "GBP" ? `£${price}` : `${currency} ${price}`,
          dateText: "",
          conditionText: String(item.itemCondition ?? ""),
          shippingText: "",
          strategy: "json_ld",
        });
        if (c) out.push(c);
      }
    } catch {
      /* ignore malformed JSON-LD */
    }
  }
  return out;
}

/** Strategy 2: s-item listing cards (class-based with fallbacks) */
function parseListingCards(html: string): ListingCandidate[] {
  const out: ListingCandidate[] = [];
  const cardRe =
    /<li[^>]*class="[^"]*s-item[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  let m: RegExpExecArray | null;
  while ((m = cardRe.exec(html)) !== null) {
    const block = m[1]!;
    if (/shop on ebay/i.test(block)) continue;

    const titleM =
      block.match(/class="[^"]*s-item__title[^"]*"[^>]*>[\s\S]*?<(?:span|div)[^>]*>([^<]+)/i) ??
      block.match(/role="heading"[^>]*>([^<]+)/i);
    const linkM = block.match(/href="(https:\/\/www\.ebay\.co\.uk\/itm\/[^"]+)"/i);
    const priceM =
      block.match(/class="[^"]*s-item__price[^"]*"[^>]*>([^<]+)/i) ??
      block.match(/class="[^"]*POSITIVE[^"]*"[^>]*>([^<]+)/i);
    const dateM =
      block.match(/class="[^"]*s-item__caption[^"]*"[^>]*>([^<]+)/i) ??
      block.match(/class="[^"]*s-item__title--tag[^"]*"[^>]*>([^<]+)/i);
    const condM = block.match(/class="[^"]*SECONDARY_INFO[^"]*"[^>]*>([^<]+)/i);

    if (!titleM || !linkM || !priceM) continue;
    const c = candidateFromParts({
      title: titleM[1]!,
      url: linkM[1]!.replace(/&amp;/g, "&"),
      priceText: priceM[1]!,
      dateText: dateM?.[1] ?? "",
      conditionText: condM?.[1] ?? "",
      shippingText: "",
      strategy: "s_item_card",
    });
    if (c) out.push(c);
  }
  return out;
}

/** Strategy 3: embedded itm links + nearby price/date text */
function parseLinkPatterns(html: string): ListingCandidate[] {
  const out: ListingCandidate[] = [];
  const re =
    /href="(https:\/\/www\.ebay\.co\.uk\/itm\/[^"]+)"[^>]*>[\s\S]{0,400}?>([^<]{5,120})<[\s\S]{0,800}?(£[\d,.]+|US \$[\d,.]+|EUR [\d,.]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const c = candidateFromParts({
      title: m[2]!,
      url: m[1]!.replace(/&amp;/g, "&"),
      priceText: m[3]!,
      dateText: html.slice(m.index, m.index + 1200).match(/Sold [^<]{5,30}|Ended [^<]{5,30}/i)?.[0] ?? "",
      conditionText: "",
      shippingText: "",
      strategy: "link_pattern",
    });
    if (c) out.push(c);
  }
  return out;
}

export function parseEbaySearchHtml(html: string): ParseResult {
  if (html.length > MAX_HTML_BYTES) {
    return { candidates: [], strategy: "none", blocked: true, blockReason: "PARSING_FAILED" };
  }

  const block = detectAccessBlock(html);
  if (block) {
    return { candidates: [], strategy: "none", blocked: true, blockReason: block };
  }

  const strategies: Array<{ name: string; fn: (h: string) => ListingCandidate[] }> = [
    { name: "json_ld", fn: parseJsonLd },
    { name: "s_item_card", fn: parseListingCards },
    { name: "link_pattern", fn: parseLinkPatterns },
  ];

  const seen = new Set<string>();
  const merged: ListingCandidate[] = [];

  for (const { name, fn } of strategies) {
    for (const c of fn(html)) {
      const key = c.itemId || c.listingUrl;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(c);
    }
    if (merged.length >= 5) break;
  }

  if (!merged.length) {
    return { candidates: [], strategy: "none", blocked: false };
  }

  return {
    candidates: merged,
    strategy: merged[0]?.parserStrategy ?? "mixed",
    blocked: false,
  };
}

export function parseEbayItemHtml(html: string): Partial<ListingCandidate> | null {
  const block = detectAccessBlock(html);
  if (block) return null;

  const title =
    html.match(/id="itemTitle"[^>]*>([^<]+)/i)?.[1] ??
    html.match(/data-testid="x-item-title"[^>]*>([^<]+)/i)?.[1] ??
    html.match(/<h1[^>]*class="[^"]*x-item-title[^"]*"[^>]*>([^<]+)/i)?.[1];

  const price =
    html.match(/itemprop="price"[^>]*content="([^"]+)"/i)?.[1] ??
    html.match(/class="[^"]*x-price-primary[^"]*"[^>]*>([^<]+)/i)?.[1];

  const currency =
    html.match(/itemprop="priceCurrency"[^>]*content="([^"]+)"/i)?.[1] ?? "GBP";

  const dateText =
    html.match(/Sold on[^<]{0,40}/i)?.[0] ??
    html.match(/Ended:[^<]{0,40}/i)?.[0] ??
    "";

  if (!title) return null;

  const priceText =
    currency === "GBP" && price && !price.includes("£") ? `£${price}` : `${currency} ${price ?? ""}`;

  return {
    listingTitle: decodeEntities(title).trim(),
    displayedPrice: priceText.trim(),
    soldDateText: dateText,
    soldDate: parseSoldDate(dateText),
    soldEvidence: /sold/i.test(html),
  };
}
