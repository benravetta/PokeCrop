import type { CardIdentity } from "./types.js";
import { generateSearchAliases } from "./searchAliasGenerator.js";

function part(v: string | null | undefined): string {
  return (v ?? "").trim();
}

/** Primary and fallback eBay search queries — sequential, never drop material IDs. */
export function buildSearchQueries(card: CardIdentity): string[] {
  const game = part(card.game) || "Pokemon";
  const name = part(card.cardName);
  const set = part(card.setName);
  const num = part(card.cardNumber);
  const edition = part(card.edition);
  const finish = part(card.finish) || part(card.variant);
  const language = part(card.language);
  const grader = part(card.grader ?? undefined);
  const grade = part(card.grade ?? undefined);
  const year = card.year ? String(card.year) : "";

  const queries: string[] = [];

  const primary = [game, name, num, set, edition, finish, language, grader, grade]
    .filter(Boolean)
    .join(" ");
  if (primary.trim()) queries.push(primary.trim());

  if (name && num) {
    const q2 = [name, num, set, edition].filter(Boolean).join(" ");
    if (q2 !== primary) queries.push(q2);
  }

  if (name && num && edition) {
    const q3 = [game, name, num, edition].filter(Boolean).join(" ");
    if (!queries.includes(q3)) queries.push(q3);
  }

  if (name && num && year && edition) {
    const q4 = [name, num, year, edition].filter(Boolean).join(" ");
    if (!queries.includes(q4)) queries.push(q4);
  }

  if (process.env.REPORT_V2_MARKET_ENGINE !== "0") {
    for (const alias of generateSearchAliases(card)) {
      if (!queries.includes(alias)) queries.push(alias);
    }
  }
  const maxQueries = process.env.REPORT_V2_MARKET_ENGINE !== "0" ? 30 : 4;
  return [...new Set(queries)].slice(0, maxQueries);
}

export function buildEbaySoldSearchUrl(query: string): string {
  const params = new URLSearchParams({
    _nkw: query.slice(0, 120),
    LH_Complete: "1",
    LH_Sold: "1",
    _sop: "13",
    _sacat: "183454",
    _ipg: "60",
  });
  return `https://www.ebay.co.uk/sch/i.html?${params.toString()}`;
}

export function canonicalItemUrl(itemId: string): string {
  return `https://www.ebay.co.uk/itm/${itemId}`;
}

export function extractItemId(url: string): string | null {
  const m = url.match(/\/itm\/(?:[^/]+\/)?(\d{9,14})/i);
  return m?.[1] ?? null;
}

export function sanitiseEbayUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/^(www\.)?ebay\.(co\.uk|com)$/i.test(u.hostname)) return null;
    const id = extractItemId(u.pathname + u.search);
    if (id) return canonicalItemUrl(id);
    if (u.pathname.includes("/itm/")) {
      u.search = "";
      return u.toString();
    }
    return null;
  } catch {
    return null;
  }
}
