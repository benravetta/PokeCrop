import { getServiceClient } from "./supabase.js";
import { fetchCardmarketRawPrice, isCardmarketConfigured } from "./cardmarket.js";
import {
  fetchPriceChartingProduct,
  gradedGbpFromProduct,
  isPriceChartingConfigured,
  rawGbpFromProduct,
} from "./priceCharting.js";
import {
  companyLikelyGrades,
  estimateCardPrices,
  type CardPricing,
  type PriceIdentity,
} from "./cardPricing.js";

const CACHE_TTL_HOURS = Number(process.env.MARKET_PRICE_CACHE_HOURS || "48");

async function readCache<T>(key: string): Promise<T | null> {
  const { data } = await getServiceClient()
    .from("market_price_cache")
    .select("payload")
    .eq("cache_key", key)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return (data?.payload as T | undefined) ?? null;
}

async function writeCache(key: string, source: string, payload: unknown): Promise<void> {
  const expires = new Date(Date.now() + CACHE_TTL_HOURS * 3600 * 1000).toISOString();
  await getServiceClient()
    .from("market_price_cache")
    .upsert({ cache_key: key, source, payload, expires_at: expires });
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function cacheKey(parts: Record<string, string | undefined>): string {
  return Object.values(parts)
    .map((v) => (v || "").toLowerCase())
    .filter(Boolean)
    .join("|");
}

function foilFromIdentity(identity: PriceIdentity): boolean {
  return /reverse holo|holo foil|gold star|shiny/i.test(str(identity.variant));
}

/**
 * Live market lookup (Cardmarket raw + PriceCharting graded) with AI fallback.
 */
export async function estimateMarketPrices(
  identity: PriceIdentity,
  companyEstimates: unknown,
  userId: string,
  opts: { timeoutMs?: number } = {}
): Promise<CardPricing | null> {
  const name = str(identity.name);
  const idConfidence = str(identity.confidence).toLowerCase();
  if (!name || idConfidence === "low") return null;

  const set = str(identity.set);
  const number = str(identity.number);
  const foil = foilFromIdentity(identity);
  const asOf = new Date().toISOString().slice(0, 10);
  const gradedTargets = companyLikelyGrades(companyEstimates);

  let rawLow: number | null = null;
  let rawHigh: number | null = null;
  let rawSource: "cardmarket" | "pricecharting" | null = null;
  const notes: string[] = [];
  const sources = new Set<string>();

  if (isCardmarketConfigured()) {
    const ck = cacheKey({ src: "cm", name, set, number, foil: foil ? "1" : "0" });
    type CmCache = { lowGbp: number; highGbp: number };
    let cm = await readCache<CmCache>(ck);
    if (!cm) {
      try {
        const live = await fetchCardmarketRawPrice({ name, set, number, foil });
        if (live) {
          cm = { lowGbp: live.lowGbp, highGbp: live.highGbp };
          await writeCache(ck, "cardmarket", cm);
        }
      } catch (err) {
        console.error("Cardmarket lookup failed:", err);
      }
    }
    if (cm) {
      rawLow = cm.lowGbp;
      rawHigh = cm.highGbp;
      rawSource = "cardmarket";
      sources.add("cardmarket");
      notes.push("Raw range from Cardmarket trend/low (EUR→GBP).");
    }
  }

  let pcProduct: Awaited<ReturnType<typeof fetchPriceChartingProduct>> = null;
  if (isPriceChartingConfigured()) {
    const ck = cacheKey({ src: "pc", name, set, number });
    type PcCache = Awaited<ReturnType<typeof fetchPriceChartingProduct>>;
    pcProduct = await readCache<PcCache>(ck);
    if (!pcProduct) {
      try {
        pcProduct = await fetchPriceChartingProduct({ name, set, number });
        if (pcProduct) await writeCache(ck, "pricecharting", pcProduct);
      } catch (err) {
        console.error("PriceCharting lookup failed:", err);
      }
    }
    if (pcProduct && rawLow == null) {
      const raw = rawGbpFromProduct(pcProduct);
      if (raw) {
        rawLow = raw.low;
        rawHigh = raw.high;
        rawSource = "pricecharting";
        sources.add("pricecharting");
        notes.push("Raw range from PriceCharting loose price (USD→GBP).");
      }
    }
  }

  const gradedOut: CardPricing["graded"] = [];
  if (pcProduct) {
    sources.add("pricecharting");
    for (const g of gradedTargets) {
      const band = gradedGbpFromProduct(pcProduct, g.company, g.grade);
      if (!band) continue;
      gradedOut.push({
        company: g.company,
        grade: g.grade,
        low: band.low,
        high: band.high,
      });
    }
    if (gradedOut.length) {
      notes.push("Graded rows from PriceCharting where a matching grade band exists.");
    }
  }

  if (rawLow != null && rawHigh != null) {
    const source: CardPricing["source"] =
      sources.size > 1 ? "mixed" : sources.has("cardmarket") ? "cardmarket" : "pricecharting";

    return {
      currency: "GBP",
      raw: { low: Math.min(rawLow, rawHigh), high: Math.max(rawLow, rawHigh) },
      graded: gradedOut,
      confidence: gradedOut.length ? "medium" : "medium",
      note:
        notes.join(" ") ||
        "Market data estimate — not a live auction comp. Slabs without PriceCharting coverage omit graded rows.",
      source,
      rawSource: rawSource ?? undefined,
      asOf,
    };
  }

  const ai = await estimateCardPrices(identity, companyEstimates, userId, opts);
  if (!ai) return null;
  return {
    ...ai,
    source: "ai",
    asOf,
    note: ai.note || "AI estimate — no live market match found for this card.",
  };
}
