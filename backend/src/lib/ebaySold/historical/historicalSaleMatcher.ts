import type { NormalisedCardIdentity } from "../types.js";
import type { HistoricalSaleRecord } from "../types.js";
import { scoreListingMatch } from "../cardListingMatcher.js";
import { normaliseGrader } from "../cardIdentityNormaliser.js";
import { extractItemId } from "../ebaySearchQueryBuilder.js";

const AGGREGATE_TERMS =
  /\b(market value|price guide|average|trend|estimated|calculated|aggregate|median price)\b/i;

const ASKING_TERMS = /\b(asking|list price|buy it now|currently listed|for sale)\b/i;

/** Reject titles with contradictory grading companies (e.g. CGC + PSA 10). */
export function hasContradictoryGrading(title: string, targetGrader?: string): boolean {
  const t = title.toLowerCase();
  const graders = ["psa", "cgc", "bgs", "beckett", "ace", "tag", "sgc"].filter((g) =>
    new RegExp(`\\b${g}\\b`).test(t)
  );
  if (graders.length <= 1) return false;

  if (/\bcgc\b/i.test(t) && /\bpsa\s*10\b/i.test(t) && targetGrader !== "cgc") return true;
  if (/\bace\b/i.test(t) && /\bpsa\s*10\b/i.test(t) && targetGrader !== "ace") return true;

  if (targetGrader) {
    const tg = normaliseGrader(targetGrader);
    const others = graders.filter((g) => normaliseGrader(g) !== tg);
    if (others.length && graders.includes(tg)) {
      const gradeMatch = t.match(/\b(10|9\.5|9|8\.5|8)\b/);
      if (gradeMatch && others.some((o) => t.includes(o))) return true;
    }
  }

  return graders.length >= 2 && !targetGrader;
}

export function validateHistoricalRecord(
  record: HistoricalSaleRecord,
  identity: NormalisedCardIdentity
): { accepted: boolean; reasonCode?: string; reason?: string; matchScore?: number } {
  if (!record.listingTitle?.trim()) {
    return { accepted: false, reasonCode: "AMBIGUOUS_ARCHIVED_RECORD", reason: "Missing title" };
  }
  if (!record.saleDate) {
    return { accepted: false, reasonCode: "AMBIGUOUS_ARCHIVED_RECORD", reason: "Missing sale date" };
  }
  if (!record.soldPriceOriginal || !record.currencyOriginal) {
    return { accepted: false, reasonCode: "AMBIGUOUS_ARCHIVED_RECORD", reason: "Missing price or currency" };
  }
  if (!record.marketplace || !/ebay/i.test(record.marketplace)) {
    return {
      accepted: false,
      reasonCode: "AMBIGUOUS_ARCHIVED_RECORD",
      reason: "Not identified as an eBay sale",
    };
  }

  const title = record.listingTitle;
  if (AGGREGATE_TERMS.test(title)) {
    return {
      accepted: false,
      reasonCode: "AMBIGUOUS_ARCHIVED_RECORD",
      reason: "Appears to be a price guide or aggregate value",
    };
  }
  if (ASKING_TERMS.test(title)) {
    return {
      accepted: false,
      reasonCode: "AMBIGUOUS_ARCHIVED_RECORD",
      reason: "Appears to be an asking price not a completed sale",
    };
  }

  if (hasContradictoryGrading(title, identity.grader ?? undefined)) {
    return {
      accepted: false,
      reasonCode: "AMBIGUOUS_ARCHIVED_RECORD",
      reason: "Contradictory grading companies in title",
    };
  }

  const match = scoreListingMatch(identity, title);
  if (!match.accepted) {
    return {
      accepted: false,
      reasonCode: "IDENTITY_MISMATCH",
      reason: match.fatalReason ?? "Card identity mismatch",
      matchScore: match.score,
    };
  }

  if (identity.conditionType === "graded" && identity.grader && record.grader) {
    if (normaliseGrader(record.grader) !== identity.normalised.grader) {
      return { accepted: false, reasonCode: "IDENTITY_MISMATCH", reason: "Grader mismatch" };
    }
  }
  if (identity.conditionType === "graded" && identity.grade && record.grade) {
    const rg = record.grade.replace(/[^\d.]/g, "");
    if (rg && rg !== identity.normalised.grade) {
      return { accepted: false, reasonCode: "IDENTITY_MISMATCH", reason: "Grade mismatch" };
    }
  }

  return { accepted: true, matchScore: match.score };
}

export function historicalDedupKey(record: HistoricalSaleRecord): string {
  if (record.originalEbayItemId) return `ebay:${record.originalEbayItemId}`;
  if (record.originalEbayUrl) {
    const id = extractItemId(record.originalEbayUrl);
    if (id) return `ebay:${id}`;
  }
  if (record.sourceSaleId) return `src:${record.sourceSaleId}`;
  return `row:${record.saleDate}|${record.soldPriceOriginal}|${record.listingTitle.toLowerCase().slice(0, 80)}`;
}
