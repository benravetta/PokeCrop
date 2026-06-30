/** eBay sold-price lookup — types (no external pricing APIs). */

export interface CardIdentity {
  game?: string;
  cardName: string;
  setName?: string;
  cardNumber?: string;
  year?: number;
  edition?: string;
  variant?: string | null;
  finish?: string | null;
  language?: string;
  conditionType: "raw" | "graded";
  grader?: string | null;
  grade?: string | null;
  currency?: string;
}

export interface NormalisedCardIdentity extends CardIdentity {
  normalised: {
    game: string;
    cardName: string;
    setName: string;
    cardNumber: string;
    cardNumberParts: { num: string; total: string };
    edition: string;
    variant: string;
    finish: string;
    language: string;
    grader: string;
    grade: string;
  };
  cacheKey: string;
}

export type SaleFormat = "auction" | "buy_it_now" | "best_offer" | "unknown";

export type ConditionNormalised =
  | "mint"
  | "near_mint"
  | "excellent"
  | "lightly_played"
  | "very_good"
  | "moderately_played"
  | "played"
  | "heavily_played"
  | "poor"
  | "damaged"
  | "unspecified";

export type EvidenceLevel = "direct" | "archived";

export type VerificationStatus = "fully_verified" | "historically_indexed";

export type EvidenceMode =
  | "direct_only"
  | "mixed_evidence"
  | "archived_only"
  | "insufficient_sales";

export interface ListingCandidate {
  listingTitle: string;
  listingUrl: string;
  itemId: string;
  displayedPrice: string;
  parsedPrice: number | null;
  currency: string;
  soldDateText: string;
  soldDate: string | null;
  condition: string;
  shippingText: string;
  saleFormat: SaleFormat;
  bestOfferDetected: boolean;
  bestOfferUnverified: boolean;
  soldEvidence: boolean;
  parserStrategy: string;
}

export interface VerifiedSale {
  ebayItemId: string | null;
  title: string;
  /** Primary link — eBay listing (direct) or archive page (archived). */
  url: string;
  soldDate: string;
  saleFormat: SaleFormat;
  conditionOriginal: string;
  conditionNormalised: ConditionNormalised;
  priceOriginal: number;
  currencyOriginal: string;
  exchangeRateToGbp: number | null;
  priceGbp: number | null;
  matchScore: number;
  matchConfidence?: number;
  possibleOutlier: boolean;
  evidenceLevel: EvidenceLevel;
  verificationStatus: VerificationStatus;
  sourceName: string;
  sourceUrl: string;
  marketplace: string;
  originalListingAvailable: boolean;
  originalEbayUrl?: string | null;
  verificationNotes: string[];
}

export interface ExcludedCandidate {
  title: string;
  url: string;
  reasonCode: string;
  reason: string;
}

export type ValuationStatus =
  | "success"
  | "no_verified_sales"
  | "temporarily_unavailable"
  | "insufficient_card_identity";

export type ValuationErrorCode =
  | "EBAY_PAGE_CHANGED"
  | "EBAY_ACCESS_BLOCKED"
  | "CAPTCHA_REQUIRED"
  | "SEARCH_TIMEOUT"
  | "SEARCH_RESULTS_UNAVAILABLE"
  | "NO_VERIFIED_SALES"
  | "INSUFFICIENT_CARD_IDENTITY"
  | "CURRENCY_RATE_UNAVAILABLE"
  | "PARSING_FAILED"
  | "ARCHIVE_SOURCE_UNAVAILABLE"
  | "ARCHIVE_PAGE_CHANGED"
  | "ARCHIVE_PARSING_FAILED"
  | "ARCHIVE_ACCESS_BLOCKED"
  | "NO_RELIABLE_HISTORICAL_SALES"
  | "AMBIGUOUS_ARCHIVED_RECORD";

export interface EbaySoldValuation {
  status: ValuationStatus;
  errorCode?: ValuationErrorCode;
  message?: string;
  card: CardIdentity;
  sales: VerifiedSale[];
  valuation: {
    salesUsed: number;
    averageSoldPriceGbp: number | null;
    medianSoldPriceGbp: number | null;
    lowestSoldPriceGbp: number | null;
    highestSoldPriceGbp: number | null;
    priceRangeGbp: number | null;
    percentageSpread: number | null;
    trendDirection?: "up" | "down" | "flat" | "unknown";
    sampleFrom?: string | null;
    sampleTo?: string | null;
    currency: "GBP";
    evidenceMode: EvidenceMode;
    directSalesCount: number;
    archivedSalesCount: number;
    limitedAverageLabel?: string;
  };
  confidence: {
    score: number;
    level: "high" | "medium" | "low";
    reasons: string[];
  };
  warnings: string[];
  excludedCandidates: ExcludedCandidate[];
  searchMetadata: {
    queryUsed: string;
    fallbackQueriesUsed: string[];
    candidatesExamined: number;
    exactMatchesFound: number;
    directEbayCandidatesExamined: number;
    directEbaySalesFound: number;
    archiveSourcesChecked: string[];
    archivedCandidatesExamined: number;
    archivedSalesFound: number;
    searchedAt: string;
    cacheHit: boolean;
    source: string;
    playwrightUsed: boolean;
    parserStrategy: string;
    aliasesSearched?: number;
  };
  rawCandidates?: ListingCandidate[];
}

/** Raw historical sale row from an archive webpage before normalisation. */
export interface HistoricalSaleRecord {
  sourceName: string;
  sourceUrl: string;
  marketplace: string;
  listingTitle: string;
  saleDate: string;
  soldPriceOriginal: number;
  currencyOriginal: string;
  grader?: string | null;
  grade?: string | null;
  cardNumber?: string;
  edition?: string;
  finish?: string;
  language?: string;
  originalEbayUrl?: string | null;
  originalEbayItemId?: string | null;
  saleFormat?: SaleFormat;
  condition?: string;
  sourceSaleId?: string;
}
