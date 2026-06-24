import crypto from "node:crypto";

const BASE = "https://api.cardmarket.com/ws/v2.0";
const POKEMON_GAME_ID = 6;

export interface CardmarketConfig {
  appToken: string;
  appSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

export function isCardmarketConfigured(): boolean {
  return Boolean(
    process.env.CARDMARKET_APP_TOKEN &&
      process.env.CARDMARKET_APP_SECRET &&
      process.env.CARDMARKET_ACCESS_TOKEN &&
      process.env.CARDMARKET_ACCESS_TOKEN_SECRET
  );
}

function configFromEnv(): CardmarketConfig {
  return {
    appToken: process.env.CARDMARKET_APP_TOKEN || "",
    appSecret: process.env.CARDMARKET_APP_SECRET || "",
    accessToken: process.env.CARDMARKET_ACCESS_TOKEN || "",
    accessTokenSecret: process.env.CARDMARKET_ACCESS_TOKEN_SECRET || "",
  };
}

function percentEncode(v: string): string {
  return encodeURIComponent(v).replace(/[!'()*]/g, (c) =>
    `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function oauthHeader(
  method: string,
  urlWithoutQuery: string,
  query: Record<string, string>,
  cfg: CardmarketConfig
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: cfg.appToken,
    oauth_token: cfg.accessToken,
    oauth_nonce: crypto.randomBytes(8).toString("hex"),
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_signature_method: "HMAC-SHA1",
    oauth_version: "1.0",
  };

  const allParams = { ...query, ...oauthParams };
  const paramString = Object.keys(allParams)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(allParams[k])}`)
    .join("&");

  const baseString = [
    method.toUpperCase(),
    percentEncode(urlWithoutQuery),
    percentEncode(paramString),
  ].join("&");

  const signingKey = `${percentEncode(cfg.appSecret)}&${percentEncode(cfg.accessTokenSecret)}`;
  const signature = crypto
    .createHmac("sha1", signingKey)
    .update(baseString)
    .digest("base64");

  const headerParams: Record<string, string> = { ...oauthParams, oauth_signature: signature };
  const authParts = Object.keys(headerParams)
    .sort()
    .map((k) => `${percentEncode(k)}="${percentEncode(headerParams[k])}"`)
    .join(", ");

  return `OAuth realm="${percentEncode(urlWithoutQuery)}", ${authParts}`;
}

interface PriceGuide {
  TREND?: string;
  LOW?: string;
  AVG?: string;
  "TREND-FOIL"?: string;
  "LOW-FOIL"?: string;
}

function parseEur(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function eurToGbp(eur: number): number {
  const rate = Number(process.env.EUR_TO_GBP || "0.85");
  return Math.round(eur * rate * 100) / 100;
}

function buildSearchQuery(parts: {
  name?: string;
  set?: string;
  number?: string;
}): string {
  const bits = [parts.name, parts.set, parts.number].filter(Boolean);
  return bits.join(" ").replace(/\s+/g, " ").trim().slice(0, 100);
}

export interface CardmarketRawPrice {
  lowGbp: number;
  highGbp: number;
  trendGbp: number | null;
  productId: number;
  productName: string;
}

async function cardmarketGet(path: string, query: Record<string, string>): Promise<unknown> {
  const cfg = configFromEnv();
  const qs = new URLSearchParams(query).toString();
  const urlWithoutQuery = `${BASE}${path}`;
  const url = qs ? `${urlWithoutQuery}?${qs}` : urlWithoutQuery;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: oauthHeader("GET", urlWithoutQuery, query, cfg),
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Cardmarket ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

function extractProduct(data: unknown): {
  idProduct: number;
  enName: string;
  priceGuide?: PriceGuide;
} | null {
  if (!data || typeof data !== "object") return null;
  const root = data as Record<string, unknown>;
  const product = (root.product ?? root.single ?? root) as Record<string, unknown>;
  if (!product || typeof product !== "object") return null;

  const id = Number(product.idProduct ?? product.id);
  const name = String(product.enName ?? product.name ?? "").trim();
  if (!Number.isFinite(id) || !name) return null;

  const pg =
    product.priceGuide && typeof product.priceGuide === "object"
      ? (product.priceGuide as PriceGuide)
      : undefined;

  return { idProduct: id, enName: name, priceGuide: pg };
}

/** Look up raw NM-ish price band from Cardmarket (EUR → GBP). */
export async function fetchCardmarketRawPrice(parts: {
  name?: string;
  set?: string;
  number?: string;
  foil?: boolean;
}): Promise<CardmarketRawPrice | null> {
  if (!isCardmarketConfigured()) return null;
  const search = buildSearchQuery(parts);
  if (!search) return null;

  const findData = await cardmarketGet("/products/find", {
    search,
    idGame: String(POKEMON_GAME_ID),
    exact: "false",
  });

  const found = extractProduct(findData);
  if (!found) return null;

  let priceGuide = found.priceGuide;
  if (!priceGuide) {
    const detail = await cardmarketGet(`/products/${found.idProduct}`, {});
    const detailed = extractProduct(detail);
    priceGuide = detailed?.priceGuide;
  }

  if (!priceGuide) return null;

  const foil = parts.foil === true;
  const lowEur = parseEur(foil ? priceGuide["LOW-FOIL"] ?? priceGuide.LOW : priceGuide.LOW);
  const trendEur = parseEur(
    foil ? priceGuide["TREND-FOIL"] ?? priceGuide.TREND : priceGuide.TREND
  );
  const avgEur = parseEur(priceGuide.AVG);

  const anchor = lowEur ?? trendEur ?? avgEur;
  if (anchor == null || anchor <= 0) return null;

  const highEur = Math.max(anchor, trendEur ?? avgEur ?? anchor * 1.15);
  const lowGbp = eurToGbp(Math.min(anchor, highEur));
  const highGbp = eurToGbp(Math.max(anchor, highEur));

  return {
    lowGbp,
    highGbp: Math.max(lowGbp, highGbp),
    trendGbp: trendEur != null ? eurToGbp(trendEur) : null,
    productId: found.idProduct,
    productName: found.enName,
  };
}
