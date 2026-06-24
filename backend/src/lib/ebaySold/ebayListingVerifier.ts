import type { ListingCandidate, VerifiedSale } from "./types.js";
import type { NormalisedCardIdentity } from "./types.js";
import { convertToGbp } from "./currencyConverter.js";
import { normaliseCondition, scoreListingMatch } from "./cardListingMatcher.js";
import { parsePrice } from "./ebayHtmlParser.js";

export interface VerificationContext {
  identity: NormalisedCardIdentity;
  postageExcluded: boolean;
}

export interface VerificationOutcome {
  accepted: boolean;
  sale?: VerifiedSale;
  excludeReason?: { code: string; reason: string };
}

function hasPostageInPrice(text: string): boolean {
  return /\+ postage|plus postage|postage £|delivery £|shipping £/i.test(text);
}

export function verifyListingCandidate(
  candidate: ListingCandidate,
  ctx: VerificationContext
): VerificationOutcome {
  const title = candidate.listingTitle;

  if (candidate.bestOfferUnverified) {
    return {
      accepted: false,
      excludeReason: {
        code: "UNVERIFIED_BEST_OFFER",
        reason: "Best Offer price could not be verified.",
      },
    };
  }

  if (candidate.bestOfferDetected && candidate.saleFormat === "best_offer") {
    if (!/best offer accepted|accepted offer/i.test(`${candidate.displayedPrice} ${title}`)) {
      return {
        accepted: false,
        excludeReason: {
          code: "UNVERIFIED_BEST_OFFER",
          reason: "The accepted Best Offer price could not be verified.",
        },
      };
    }
  }

  if (!candidate.soldEvidence && !candidate.soldDate) {
    return {
      accepted: false,
      excludeReason: {
        code: "NOT_SOLD",
        reason: "Listing does not show clear sold evidence.",
      },
    };
  }

  if (candidate.parsedPrice == null || !candidate.currency) {
    return {
      accepted: false,
      excludeReason: {
        code: "PRICE_UNPARSEABLE",
        reason: "Sold price could not be parsed.",
      },
    };
  }

  if (hasPostageInPrice(`${candidate.displayedPrice} ${candidate.shippingText}`)) {
    return {
      accepted: false,
      excludeReason: {
        code: "POSTAGE_INCLUDED",
        reason: "Price appears to include postage.",
      },
    };
  }

  const match = scoreListingMatch(ctx.identity, title);
  if (!match.accepted) {
    return {
      accepted: false,
      excludeReason: {
        code: "IDENTITY_MISMATCH",
        reason: match.fatalReason ?? `Match score ${match.score} below threshold`,
      },
    };
  }

  const conversion = convertToGbp(candidate.parsedPrice, candidate.currency);
  if (!conversion) {
    return {
      accepted: false,
      excludeReason: {
        code: "CURRENCY_RATE_UNAVAILABLE",
        reason: `No exchange rate for ${candidate.currency}`,
      },
    };
  }

  const notes: string[] = [...match.warnings];
  if (conversion.stale) notes.push("Exchange rate data is stale");

  const sale: VerifiedSale = {
    ebayItemId: candidate.itemId || null,
    title,
    url: candidate.listingUrl,
    soldDate: candidate.soldDate ?? new Date().toISOString().slice(0, 10),
    saleFormat: candidate.saleFormat,
    conditionOriginal: candidate.condition || "unspecified",
    conditionNormalised: normaliseCondition(candidate.condition),
    priceOriginal: candidate.parsedPrice,
    currencyOriginal: candidate.currency,
    exchangeRateToGbp: conversion.rate,
    priceGbp: conversion.gbp,
    matchScore: match.score,
    possibleOutlier: false,
    evidenceLevel: "direct",
    verificationStatus: "fully_verified",
    sourceName: "eBay",
    sourceUrl: candidate.listingUrl,
    marketplace: "eBay",
    originalListingAvailable: true,
    originalEbayUrl: candidate.listingUrl,
    verificationNotes: notes,
  };

  return { accepted: true, sale };
}

/** Merge detail-page verification into candidate. */
export function enrichCandidateFromDetail(
  candidate: ListingCandidate,
  detail: Partial<ListingCandidate>
): ListingCandidate {
  const priceText = detail.displayedPrice ?? candidate.displayedPrice;
  const parsed = parsePrice(priceText);
  return {
    ...candidate,
    listingTitle: detail.listingTitle ?? candidate.listingTitle,
    displayedPrice: priceText,
    parsedPrice: parsed?.amount ?? candidate.parsedPrice,
    currency: parsed?.currency ?? candidate.currency,
    soldDateText: detail.soldDateText ?? candidate.soldDateText,
    soldDate: detail.soldDate ?? candidate.soldDate,
    soldEvidence: detail.soldEvidence ?? candidate.soldEvidence,
  };
}

export function dedupeSales(sales: VerifiedSale[]): VerifiedSale[] {
  const seen = new Set<string>();
  const out: VerifiedSale[] = [];
  for (const s of sales) {
    const key =
      s.ebayItemId ??
      s.originalEbayUrl ??
      `${s.evidenceLevel}|${s.title}|${s.soldDate}|${s.priceOriginal}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}
