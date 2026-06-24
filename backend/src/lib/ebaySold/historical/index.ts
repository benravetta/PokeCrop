import type { CardIdentity } from "../types.js";
import type { VerifiedSale } from "../types.js";
import type { NormalisedCardIdentity } from "../types.js";
import { priceChartingHistoricalSource } from "./priceChartingHistoricalSource.js";
import { psaAuctionHistorySource } from "./psaAuctionHistorySource.js";
import type { HistoricalSaleSource } from "./archiveSources.js";
import { dedupeArchivedRecords } from "./historicalSaleDeduplicator.js";
import { normaliseHistoricalRecords } from "./historicalSaleNormaliser.js";
import {
  readArchiveCacheSafe,
  writeArchiveCacheSafe,
} from "../searchResultCache.js";

const sources: HistoricalSaleSource[] = [
  priceChartingHistoricalSource,
  psaAuctionHistorySource,
];

export interface ArchiveSearchResult {
  sales: VerifiedSale[];
  excluded: Array<{ title: string; url: string; reasonCode: string; reason: string }>;
  sourcesChecked: string[];
  candidatesExamined: number;
  errors: Array<{ source: string; code: string; message?: string }>;
}

export async function fetchHistoricalSales(
  card: CardIdentity,
  identity: NormalisedCardIdentity,
  opts: { timeoutMs?: number; skipCache?: boolean } = {}
): Promise<ArchiveSearchResult> {
  const sales: VerifiedSale[] = [];
  const excluded: Array<{ title: string; url: string; reasonCode: string; reason: string }> = [];
  const sourcesChecked: string[] = [];
  const errors: ArchiveSearchResult["errors"] = [];
  let candidatesExamined = 0;

  for (const source of sources) {
    if (!source.supports(card)) continue;
    sourcesChecked.push(source.name);

    if (!opts.skipCache) {
      const cached = await readArchiveCacheSafe(identity.cacheKey, source.name);
      if (cached) {
        sales.push(...cached.sales);
        excluded.push(...cached.excluded);
        candidatesExamined += cached.candidatesExamined;
        continue;
      }
    }

    const result = await source.fetch(card, { timeoutMs: opts.timeoutMs });
    candidatesExamined += result.records.length;

    if (result.errorCode) {
      errors.push({ source: source.name, code: result.errorCode, message: result.errorMessage });
    }

    const deduped = dedupeArchivedRecords(result.records);
    const normalised = normaliseHistoricalRecords(deduped, identity);
    sales.push(...normalised.sales);
    excluded.push(...normalised.excluded, ...result.excluded);

    await writeArchiveCacheSafe(identity.cacheKey, source.name, {
      sales: normalised.sales,
      excluded: [...normalised.excluded, ...result.excluded],
      candidatesExamined: result.records.length,
    });
  }

  return { sales, excluded, sourcesChecked, candidatesExamined, errors };
}

export { priceChartingHistoricalSource, psaAuctionHistorySource };
export { parsePriceChartingSaleRows } from "./priceChartingHistoricalSource.js";
export { parsePsaAuctionRows } from "./psaAuctionHistorySource.js";
