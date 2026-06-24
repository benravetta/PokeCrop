import { getServiceClient } from "../supabase.js";
import type { EbaySoldValuation, VerifiedSale } from "./types.js";

export type CacheKind = "success" | "no_results" | "blocked" | "archive";

const TTL_MS: Record<CacheKind, number> = {
  success: Number(process.env.EBAY_SOLD_CACHE_SUCCESS_HOURS || "9") * 3600_000,
  no_results: Number(process.env.EBAY_SOLD_CACHE_EMPTY_HOURS || "2") * 3600_000,
  blocked: Number(process.env.EBAY_SOLD_CACHE_BLOCK_MINUTES || "20") * 60_000,
  archive: Number(process.env.EBAY_ARCHIVE_CACHE_HOURS || "24") * 3600_000,
};

const ARCHIVE_EMPTY_MS = Number(process.env.EBAY_ARCHIVE_EMPTY_HOURS || "6") * 3600_000;

function cacheKind(valuation: EbaySoldValuation): CacheKind {
  if (valuation.status === "temporarily_unavailable") return "blocked";
  if (valuation.status === "no_verified_sales" || !valuation.sales.length) return "no_results";
  return "success";
}

export interface ArchiveCachePayload {
  sales: VerifiedSale[];
  excluded: Array<{ title: string; url: string; reasonCode: string; reason: string }>;
  candidatesExamined: number;
}

const memValuation = new Map<string, { exp: number; val: EbaySoldValuation }>();
const memArchive = new Map<string, { exp: number; val: ArchiveCachePayload }>();

async function readCache(key: string): Promise<unknown | null> {
  try {
    const { data } = await getServiceClient()
      .from("market_price_cache")
      .select("payload")
      .eq("cache_key", key)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    return data?.payload ?? null;
  } catch {
    return null;
  }
}

async function writeCache(key: string, source: string, payload: unknown, ttlMs: number): Promise<void> {
  try {
    const expires = new Date(Date.now() + ttlMs).toISOString();
    await getServiceClient()
      .from("market_price_cache")
      .upsert({ cache_key: key, source, payload, expires_at: expires });
  } catch (err) {
    console.error("cache write failed:", key, err);
  }
}

export async function readValuationCache(cacheKey: string): Promise<EbaySoldValuation | null> {
  const payload = (await readCache(`ebay_sold|${cacheKey}`)) as EbaySoldValuation | null;
  return payload ?? null;
}

export async function writeValuationCache(
  cacheKey: string,
  valuation: EbaySoldValuation
): Promise<void> {
  const kind = cacheKind(valuation);
  memValuation.set(cacheKey, { exp: Date.now() + TTL_MS[kind], val: valuation });
  await writeCache(`ebay_sold|${cacheKey}`, "ebay_sold", valuation, TTL_MS[kind]);
}

export async function readValuationCacheSafe(cacheKey: string): Promise<EbaySoldValuation | null> {
  const db = await readValuationCache(cacheKey);
  if (db) return { ...db, searchMetadata: { ...db.searchMetadata, cacheHit: true } };

  const mem = memValuation.get(cacheKey);
  if (mem && mem.exp > Date.now()) {
    return { ...mem.val, searchMetadata: { ...mem.val.searchMetadata, cacheHit: true } };
  }
  return null;
}

export async function writeValuationCacheSafe(
  cacheKey: string,
  valuation: EbaySoldValuation
): Promise<void> {
  await writeValuationCache(cacheKey, valuation);
}

export async function readArchiveCacheSafe(
  cacheKey: string,
  sourceName: string
): Promise<ArchiveCachePayload | null> {
  const key = `ebay_archive|${sourceName.toLowerCase().replace(/\s+/g, "-")}|${cacheKey}`;
  const db = (await readCache(key)) as ArchiveCachePayload | null;
  if (db) return db;

  const mem = memArchive.get(key);
  if (mem && mem.exp > Date.now()) return mem.val;
  return null;
}

export async function writeArchiveCacheSafe(
  cacheKey: string,
  sourceName: string,
  payload: ArchiveCachePayload
): Promise<void> {
  const key = `ebay_archive|${sourceName.toLowerCase().replace(/\s+/g, "-")}|${cacheKey}`;
  const ttl = payload.sales.length ? TTL_MS.archive : ARCHIVE_EMPTY_MS;
  memArchive.set(key, { exp: Date.now() + ttl, val: payload });
  await writeCache(key, "ebay_archive", payload, ttl);
}

export function clearMemoryCacheForTests(): void {
  memValuation.clear();
  memArchive.clear();
}
