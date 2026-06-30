import type { CardIdentity, EbaySoldValuation, ExcludedCandidate, VerifiedSale } from "./types.js";
import {
  cardIdentityFromGradeFields,
  gradedIdentityFromRaw,
  hasMinimumIdentity,
  normaliseCardIdentity,
} from "./cardIdentityNormaliser.js";
import { buildSearchQueries } from "./ebaySearchQueryBuilder.js";
import {
  dedupeSales,
  enrichCandidateFromDetail,
  verifyListingCandidate,
} from "./ebayListingVerifier.js";
import {
  calculateSoldPriceStats,
  markOutliers,
  sortSalesByRecency,
} from "./soldPriceCalculator.js";
import { calculateValuationConfidence } from "./valuationConfidenceCalculator.js";
import { readValuationCacheSafe, writeValuationCacheSafe } from "./searchResultCache.js";
import {
  fetchEbayItemPage,
  fetchEbaySearchPage,
  parseCandidatesFromHtml,
} from "./ebaySearchClient.js";
import { parseEbaySearchHtml } from "./ebayHtmlParser.js";
import { fetchHistoricalSales } from "./historical/index.js";
import { mergeAndSelectSales } from "./historical/historicalSaleDeduplicator.js";

const MAX_DETAIL_CHECKS = 5;
const TARGET_SALES = 3;

export interface LookupOptions {
  timeoutMs?: number;
  skipCache?: boolean;
}

function emptyValuationFields(): EbaySoldValuation["valuation"] {
  return {
    salesUsed: 0,
    averageSoldPriceGbp: null,
    medianSoldPriceGbp: null,
    lowestSoldPriceGbp: null,
    highestSoldPriceGbp: null,
    priceRangeGbp: null,
    percentageSpread: null,
    trendDirection: "unknown",
    sampleFrom: null,
    sampleTo: null,
    currency: "GBP",
    evidenceMode: "insufficient_sales",
    directSalesCount: 0,
    archivedSalesCount: 0,
  };
}

function emptySearchMeta(
  partial: Partial<EbaySoldValuation["searchMetadata"]> = {}
): EbaySoldValuation["searchMetadata"] {
  return {
    queryUsed: "",
    fallbackQueriesUsed: [],
    candidatesExamined: 0,
    exactMatchesFound: 0,
    directEbayCandidatesExamined: 0,
    directEbaySalesFound: 0,
    archiveSourcesChecked: [],
    archivedCandidatesExamined: 0,
    archivedSalesFound: 0,
    searchedAt: new Date().toISOString(),
    cacheHit: false,
    source: "eBay public sold-listing pages",
    playwrightUsed: false,
    parserStrategy: "none",
    aliasesSearched: 0,
    ...partial,
  };
}

function errorValuation(
  card: CardIdentity,
  errorCode: EbaySoldValuation["errorCode"],
  message: string,
  meta: Partial<EbaySoldValuation["searchMetadata"]> = {}
): EbaySoldValuation {
  return {
    status: "temporarily_unavailable",
    errorCode,
    message,
    card,
    sales: [],
    valuation: emptyValuationFields(),
    confidence: { score: 0, level: "low", reasons: [] },
    warnings: [],
    excludedCandidates: [],
    searchMetadata: emptySearchMeta(meta),
  };
}

async function searchDirectEbaySales(
  card: CardIdentity,
  identity: ReturnType<typeof normaliseCardIdentity>,
  opts: { started: number; timeoutMs: number }
): Promise<{
  direct: VerifiedSale[];
  excluded: ExcludedCandidate[];
  rawCandidates: import("./types.js").ListingCandidate[];
  meta: {
    queryUsed: string;
    fallbackQueries: string[];
    candidatesExamined: number;
    playwrightUsed: boolean;
    parserStrategy: string;
    aliasesSearched: number;
  };
  blocked?: EbaySoldValuation;
}> {
  const queries = buildSearchQueries(card);
  const direct: VerifiedSale[] = [];
  const excluded: ExcludedCandidate[] = [];
  let candidatesExamined = 0;
  let queryUsed = "";
  const fallbackQueries: string[] = [];
  let playwrightUsed = false;
  let parserStrategy = "none";
  const rawCandidates: import("./types.js").ListingCandidate[] = [];
  let detailChecks = 0;

  for (const query of queries) {
    if (Date.now() - opts.started > opts.timeoutMs) break;
    if (direct.length >= TARGET_SALES) break;

    if (queryUsed && query !== queryUsed) fallbackQueries.push(query);
    if (!queryUsed) queryUsed = query;

    const fetch = await fetchEbaySearchPage(query, {
      timeoutMs: Math.min(25_000, opts.timeoutMs - (Date.now() - opts.started)),
    });

    playwrightUsed = playwrightUsed || fetch.playwrightUsed;

    if (!fetch.ok) {
      if (fetch.errorCode === "EBAY_ACCESS_BLOCKED" || fetch.errorCode === "CAPTCHA_REQUIRED") {
        return {
          direct,
          excluded,
          rawCandidates,
          meta: {
            queryUsed,
            fallbackQueries,
            candidatesExamined,
            playwrightUsed,
            parserStrategy,
            aliasesSearched: queries.length,
          },
          blocked: errorValuation(card, fetch.errorCode, fetch.message ?? "", {
            queryUsed,
            fallbackQueriesUsed: fallbackQueries,
            playwrightUsed,
            aliasesSearched: queries.length,
          }),
        };
      }
      continue;
    }

    const parsed = fetch.html
      ? parseEbaySearchHtml(fetch.html)
      : { candidates: [], strategy: "none", blocked: false };
    rawCandidates.push(...parsed.candidates);
    parserStrategy = parsed.strategy || parserStrategy;

    for (const candidate of parsed.candidates) {
      if (direct.length >= TARGET_SALES) break;
      candidatesExamined++;

      let working = candidate;
      const preliminary = verifyListingCandidate(working, { identity, postageExcluded: true });

      if (
        !preliminary.accepted &&
        preliminary.excludeReason?.code === "NOT_SOLD" &&
        detailChecks < MAX_DETAIL_CHECKS
      ) {
        detailChecks++;
        const detail = await fetchEbayItemPage(working.listingUrl, { timeoutMs: 12_000 });
        if (detail) working = enrichCandidateFromDetail(working, detail);
      }

      const outcome = verifyListingCandidate(working, { identity, postageExcluded: true });
      if (outcome.accepted && outcome.sale) {
        direct.push(outcome.sale);
      } else if (outcome.excludeReason) {
        excluded.push({
          title: working.listingTitle,
          url: working.listingUrl,
          reasonCode: outcome.excludeReason.code,
          reason: outcome.excludeReason.reason,
        });
      }
    }
  }

  return {
    direct,
    excluded,
    rawCandidates,
    meta: {
      queryUsed,
      fallbackQueries,
      candidatesExamined,
      playwrightUsed,
      parserStrategy,
      aliasesSearched: queries.length,
    },
  };
}

function buildWarnings(
  stats: ReturnType<typeof calculateSoldPriceStats>,
  sales: VerifiedSale[],
  archiveErrors: Array<{ source: string; code: string; message?: string }>,
  directCount: number
): string[] {
  const warnings: string[] = [];

  if (stats.limitedAverageLabel) warnings.push(stats.limitedAverageLabel);
  if (sales.some((s) => s.possibleOutlier)) {
    warnings.push("One or more sales may be price outliers — check individual listings.");
  }

  if (stats.evidenceMode === "mixed_evidence") {
    warnings.push(
      "This valuation includes historical eBay sale records from public price-history sources because the original completed listings are no longer available on eBay."
    );
  }
  if (stats.evidenceMode === "archived_only") {
    warnings.push(
      "This valuation is based entirely on publicly indexed historical eBay sales. The original eBay listing pages are no longer available."
    );
  }

  if (directCount > 0 && directCount < 3 && archiveErrors.length) {
    warnings.push(
      "Historical archive fallback was partially unavailable — only verified records found are shown."
    );
  }

  warnings.push(
    "Sold prices can vary significantly with card condition, listing quality, timing and buyer demand. Postage is excluded."
  );

  return warnings;
}

function countArchiveConfidenceFlags(sales: VerifiedSale[]) {
  let archivedMissingCardNumber = 0;
  let archivedMissingEbayId = 0;
  let unclearArchivedTitles = 0;
  let inferredCurrency = 0;

  for (const s of sales) {
    if (s.evidenceLevel !== "archived") continue;
    if (!/\d+\s*\/\s*\d+/.test(s.title) && !/\b#\d+/.test(s.title)) archivedMissingCardNumber++;
    if (!s.ebayItemId) archivedMissingEbayId++;
    if (/or best offer|see photos|read description/i.test(s.title)) unclearArchivedTitles++;
    if (s.verificationNotes.some((n) => /inferred/i.test(n))) inferredCurrency++;
  }

  return { archivedMissingCardNumber, archivedMissingEbayId, unclearArchivedTitles, inferredCurrency };
}

export async function lookupEbaySoldPrices(
  card: CardIdentity,
  opts: LookupOptions = {}
): Promise<EbaySoldValuation> {
  const started = Date.now();
  const timeoutMs = opts.timeoutMs ?? 60_000;

  if (!hasMinimumIdentity(card)) {
    return {
      status: "insufficient_card_identity",
      errorCode: "INSUFFICIENT_CARD_IDENTITY",
      message: "Card name and either set or collector number are required.",
      card,
      sales: [],
      valuation: emptyValuationFields(),
      confidence: { score: 0, level: "low", reasons: [] },
      warnings: [],
      excludedCandidates: [],
      searchMetadata: emptySearchMeta(),
    };
  }

  const identity = normaliseCardIdentity(card);

  if (!opts.skipCache) {
    const cached = await readValuationCacheSafe(identity.cacheKey);
    if (cached) return cached;
  }

  const ebaySearch = await searchDirectEbaySales(card, identity, { started, timeoutMs });
  if (ebaySearch.blocked && !ebaySearch.direct.length) {
    await writeValuationCacheSafe(identity.cacheKey, ebaySearch.blocked);
    return ebaySearch.blocked;
  }

  let direct = dedupeSales(sortSalesByRecency(ebaySearch.direct));
  const excluded = [...ebaySearch.excluded];
  let archived: VerifiedSale[] = [];
  let archiveSourcesChecked: string[] = [];
  let archivedCandidatesExamined = 0;
  let archiveErrors: Array<{ source: string; code: string; message?: string }> = [];

  if (direct.length < TARGET_SALES) {
    const archive = await fetchHistoricalSales(card, identity, {
      timeoutMs: Math.max(10_000, timeoutMs - (Date.now() - started)),
      skipCache: opts.skipCache,
    });
    archived = archive.sales;
    excluded.push(...archive.excluded);
    archiveSourcesChecked = archive.sourcesChecked;
    archivedCandidatesExamined = archive.candidatesExamined;
    archiveErrors = archive.errors;
  }

  const combined = mergeAndSelectSales(direct, archived, TARGET_SALES);
  const withOutliers = markOutliers(combined);
  const stats = calculateSoldPriceStats(withOutliers);

  const searchMetadata = emptySearchMeta({
    queryUsed: ebaySearch.meta.queryUsed,
    fallbackQueriesUsed: ebaySearch.meta.fallbackQueries,
    candidatesExamined: ebaySearch.meta.candidatesExamined + archivedCandidatesExamined,
    exactMatchesFound: withOutliers.length,
    directEbayCandidatesExamined: ebaySearch.meta.candidatesExamined,
    directEbaySalesFound: direct.length,
    archiveSourcesChecked,
    archivedCandidatesExamined,
    archivedSalesFound: archived.length,
    playwrightUsed: ebaySearch.meta.playwrightUsed,
    parserStrategy: ebaySearch.meta.parserStrategy,
    aliasesSearched: ebaySearch.meta.aliasesSearched,
  });

  if (!withOutliers.length) {
    const empty: EbaySoldValuation = {
      status: "no_verified_sales",
      errorCode: "NO_VERIFIED_SALES",
      message: "No verified comparable eBay sold listings were found for this exact card.",
      card,
      sales: [],
      valuation: emptyValuationFields(),
      confidence: { score: 0, level: "low", reasons: ["No verified sales"] },
      warnings: [],
      excludedCandidates: excluded.slice(0, 30),
      searchMetadata,
      rawCandidates: ebaySearch.rawCandidates,
    };
    await writeValuationCacheSafe(identity.cacheKey, empty);
    return empty;
  }

  const staleFx = withOutliers.some((s) => s.verificationNotes.some((n) => n.includes("stale")));
  const partialDates = withOutliers.some((s) => !s.soldDate);
  const archiveFlags = countArchiveConfidenceFlags(withOutliers);

  const confidence = calculateValuationConfidence(withOutliers, stats, {
    staleFx,
    partialDates,
    accessoryListings: 0,
    ...archiveFlags,
  });

  const warnings = buildWarnings(stats, withOutliers, archiveErrors, direct.length);

  const result: EbaySoldValuation = {
    status: "success",
    card,
    sales: withOutliers,
    valuation: {
      ...stats,
      currency: "GBP",
      limitedAverageLabel: stats.limitedAverageLabel,
    },
    confidence,
    warnings,
    excludedCandidates: excluded.slice(0, 30),
    searchMetadata,
    rawCandidates: ebaySearch.rawCandidates,
  };

  console.info("[ebaySold]", {
    cacheKey: identity.cacheKey,
    direct: stats.directSalesCount,
    archived: stats.archivedSalesCount,
    evidenceMode: stats.evidenceMode,
    durationMs: Date.now() - started,
    confidence: confidence.score,
  });

  await writeValuationCacheSafe(identity.cacheKey, result);
  return result;
}

export { cardIdentityFromGradeFields, gradedIdentityFromRaw, parseCandidatesFromHtml };
