import type { MarketComp } from "./marketComps.js";

const TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const SEARCH_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search";

let cachedToken: { token: string; exp: number } | null = null;

export function isEbayConfigured(): boolean {
  return Boolean(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET);
}

function marketplaceId(): string {
  return process.env.EBAY_MARKETPLACE_ID || "EBAY_GB";
}

function categoryIds(): string | undefined {
  return process.env.EBAY_CATEGORY_IDS || "183454";
}

async function getToken(): Promise<string | null> {
  if (!isEbayConfigured()) return null;
  const now = Date.now();
  if (cachedToken && cachedToken.exp > now + 60_000) return cachedToken.token;

  const id = process.env.EBAY_CLIENT_ID!;
  const secret = process.env.EBAY_CLIENT_SECRET!;
  const basic = Buffer.from(`${id}:${secret}`).toString("base64");

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: "https://api.ebay.com/oauth/api_scope",
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    console.error("eBay OAuth failed:", res.status, (await res.text()).slice(0, 200));
    return null;
  }

  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) return null;
  cachedToken = {
    token: data.access_token,
    exp: now + (data.expires_in ?? 7200) * 1000,
  };
  return data.access_token;
}

function gbpFromItem(item: Record<string, unknown>): number | null {
  const price = item.price as Record<string, unknown> | undefined;
  if (!price) return null;
  const value = Number(price.value);
  if (!Number.isFinite(value) || value <= 0) return null;
  const currency = String(price.currency ?? "GBP").toUpperCase();
  if (currency === "GBP") return Math.round(value * 100) / 100;
  if (currency === "USD") {
    const rate = Number(process.env.USD_TO_GBP || "0.79");
    return Math.round(value * rate * 100) / 100;
  }
  if (currency === "EUR") {
    const rate = Number(process.env.EUR_TO_GBP || "0.85");
    return Math.round(value * rate * 100) / 100;
  }
  return null;
}

function titleMatchesCard(title: string, name: string, set?: string, number?: string): boolean {
  const t = title.toLowerCase();
  const nameTokens = name
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  if (!nameTokens.length) return false;
  const hits = nameTokens.filter((w) => t.includes(w)).length;
  if (hits < Math.min(2, nameTokens.length)) return false;

  if (number) {
    const num = number.replace(/^0+/, "") || number;
    const numPadded = number.padStart(num.length, "0");
    const numOk =
      t.includes(number.toLowerCase()) ||
      t.includes(num) ||
      t.includes(`#${num}`) ||
      t.includes(`/${num}`) ||
      (numPadded !== num && t.includes(numPadded));
    if (!numOk) return false;
  }

  if (set) {
    const setLower = set.toLowerCase();
    if (setLower.length <= 3) {
      if (!t.includes(setLower)) return false;
    } else {
      const setWords = setLower.split(/\s+/).filter((w) => w.length > 2);
      const setHit =
        t.includes(setLower) ||
        (setWords.length > 0 &&
          setWords.filter((w) => t.includes(w)).length >= Math.min(2, setWords.length));
      if (!setHit) return false;
    }
  }

  // Drop obvious junk listings that skew medians.
  if (/\b(lot|bundle|bulk|proxy|custom|reprint|playset|play set|booster|box)\b/i.test(t)) {
    return false;
  }

  return true;
}

function buildQuery(parts: {
  name: string;
  set?: string;
  number?: string;
  graded?: { company: string; grade: string };
}): string {
  const bits = [parts.name, parts.set, parts.number ? `#${parts.number}` : ""];
  if (parts.graded) bits.push(parts.graded.company, parts.graded.grade);
  return bits.filter(Boolean).join(" ").replace(/\s+/g, " ").trim().slice(0, 100);
}

async function searchItems(q: string, limit = 25): Promise<Record<string, unknown>[]> {
  const token = await getToken();
  if (!token || !q) return [];

  const params = new URLSearchParams({
    q,
    limit: String(Math.min(limit, 50)),
  });
  const cat = categoryIds();
  if (cat) params.set("category_ids", cat);

  const res = await fetch(`${SEARCH_URL}?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": marketplaceId(),
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    console.error("eBay search failed:", res.status, (await res.text()).slice(0, 200));
    return [];
  }

  const data = (await res.json()) as { itemSummaries?: Record<string, unknown>[] };
  return data.itemSummaries ?? [];
}

/** Current eBay UK listing prices matching the card (proxy comps — not sold history unless Insights is added). */
export async function fetchEbayListingComps(parts: {
  name: string;
  set?: string;
  number?: string;
  graded?: { company: string; grade: string };
}): Promise<MarketComp[]> {
  if (!isEbayConfigured()) return [];
  const q = buildQuery(parts);
  const items = await searchItems(q);
  const comps: MarketComp[] = [];

  for (const item of items) {
    const title = String(item.title ?? "");
    if (!titleMatchesCard(title, parts.name, parts.set, parts.number)) continue;
    const priceGbp = gbpFromItem(item);
    if (priceGbp == null) continue;
    comps.push({
      source: "ebay",
      kind: parts.graded ? "graded" : "raw",
      priceGbp,
      company: parts.graded?.company,
      grade: parts.graded?.grade,
      label: title.slice(0, 120),
    });
  }

  return comps;
}
