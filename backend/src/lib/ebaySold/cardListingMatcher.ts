import type { NormalisedCardIdentity } from "./types.js";
import {
  cardNumberVariants,
  normaliseEdition,
  normaliseFinish,
  normaliseGrader,
  normaliseText,
} from "./cardIdentityNormaliser.js";

export interface MatchResult {
  score: number;
  accepted: boolean;
  fatalReason?: string;
  warnings: string[];
}

const NEGATIVE_KEYWORDS = [
  "proxy",
  "custom",
  "fan made",
  "fanmade",
  "replica",
  "reproduction",
  "metal card",
  "jumbo",
  "oversized",
  "digital",
  "online code",
  "booster box",
  "booster pack",
  "binder",
  "job lot",
  "complete set",
  "full set",
  "mystery",
  "mystery pack",
  "altered",
  "signed",
  "autograph",
  "choose your card",
  "pick your card",
];

const BUNDLE_KEYWORDS = [
  "lot of",
  " x2",
  " x3",
  " x4",
  " x5",
  " 2x ",
  " 3x ",
  " 4x ",
  "bundle",
  "multi listing",
  "multiple cards",
  "collection of",
  "complete set",
  "full set",
  "job lot",
];

const GRADERS = ["psa", "bgs", "beckett", "cgc", "tag", "ace", "sgc"];

function containsWord(text: string, word: string): boolean {
  return new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text);
}

function titleHasGrader(text: string): string | null {
  const t = normaliseText(text);
  for (const g of GRADERS) {
    if (containsWord(t, g)) return g;
  }
  return null;
}

function extractGradeFromTitle(text: string): string | null {
  const t = normaliseText(text);
  for (const g of GRADERS) {
    const m = t.match(new RegExp(`${g}\\s*([0-9]+(?:\\.[0-9])?)`, "i"));
    if (m) return m[1] ?? null;
  }
  const m = t.match(/\b(10|9\.5|9|8\.5|8|7|6|5)\b/);
  return m?.[1] ?? null;
}

function fatalContradiction(
  identity: NormalisedCardIdentity,
  title: string
): string | undefined {
  const t = normaliseText(title);
  const n = identity.normalised;

  if (n.edition) {
    if (n.edition === "first edition" && containsWord(t, "unlimited")) {
      return "Requested 1st Edition but listing says Unlimited";
    }
    if (n.edition === "unlimited" && containsWord(t, "1st edition")) {
      return "Requested Unlimited but listing says 1st Edition";
    }
    if (n.edition === "shadowless" && containsWord(t, "unlimited")) {
      return "Requested Shadowless but listing contradicts";
    }
  }

  if (identity.finish || identity.variant) {
    if (n.finish === "reverse holo" && /\bnon holo\b|\bnon-holo\b/.test(t)) {
      return "Requested reverse holo but listing says non-holo";
    }
    if (n.finish === "holo") {
      if (/\bnon holo\b|\bnon-holo\b/.test(t)) return "Requested holo but listing says non-holo";
      if (/\breverse holo\b/.test(t)) return "Requested holo but listing is reverse holo";
    }
    if (n.finish === "non holo" && /\bholo\b/.test(t) && !/\bnon holo\b/.test(t)) {
      return "Requested non-holo but listing appears holo";
    }
  }

  if (identity.language) {
    if (n.language.includes("english") && /\bjapanese\b|\bjp\b|\bjapan\b/.test(t)) {
      return "Requested English but listing is Japanese";
    }
    if (n.language.includes("japanese") && /\benglish\b/.test(t) && !/\bjapanese\b/.test(t)) {
      return "Requested Japanese but listing appears English";
    }
  }

  if (n.cardNumberParts.num) {
    const variants = cardNumberVariants(identity.cardNumber ?? "");
    const hasNum = variants.some((v) => t.includes(v));
    const wrongNum = t.match(/\b(\d{1,3})\s*\/\s*(\d{2,3})\b/);
    if (wrongNum) {
      const found = `${wrongNum[1]}/${wrongNum[2]}`;
      if (!variants.some((v) => v.includes(found.replace(/\s/g, "")))) {
        return `Card number mismatch (${found})`;
      }
    } else if (!hasNum && n.cardNumberParts.num.length <= 3) {
      return "Card number not found in listing";
    }
  }

  const listedGrader = titleHasGrader(t);
  if (identity.conditionType === "raw") {
    if (listedGrader && !/\bworthy\b|\bcandidate\b|\bready\b/.test(t)) {
      return "Requested raw but item is professionally graded";
    }
  } else {
    if (!listedGrader) return "Requested graded but no grader found in title";
    if (n.grader && normaliseGrader(listedGrader) !== n.grader) {
      return "Grading company mismatch";
    }
    const listedGrade = extractGradeFromTitle(t);
    if (n.grade && listedGrade && listedGrade !== n.grade) {
      return "Grade mismatch";
    }
  }

  for (const kw of NEGATIVE_KEYWORDS) {
    if (t.includes(kw)) return `Incompatible keyword: ${kw}`;
  }

  for (const kw of BUNDLE_KEYWORDS) {
    if (t.includes(kw)) return "Multi-card or bundle listing";
  }

  return undefined;
}

export function scoreListingMatch(
  identity: NormalisedCardIdentity,
  title: string
): MatchResult {
  const warnings: string[] = [];
  const fatal = fatalContradiction(identity, title);
  if (fatal) {
    return { score: 0, accepted: false, fatalReason: fatal, warnings };
  }

  const t = normaliseText(title);
  const n = identity.normalised;
  let score = 0;

  if (n.cardName && t.includes(n.cardName)) score += 20;
  else return { score: 0, accepted: false, fatalReason: "Card name not found", warnings };

  if (n.cardNumberParts.num) {
    const variants = cardNumberVariants(identity.cardNumber ?? "");
    if (variants.some((v) => t.includes(v))) score += 20;
    else {
      warnings.push("Card number not explicit");
      score += 0;
    }
  } else {
    warnings.push("No card number to match");
  }

  if (n.setName) {
    if (t.includes(n.setName)) score += 15;
    else {
      const words = n.setName.split(" ").filter((w) => w.length > 2);
      if (words.filter((w) => t.includes(w)).length >= Math.min(2, words.length)) score += 10;
      else warnings.push("Set name not explicit");
    }
  }

  if (n.edition) {
    if (t.includes(n.edition) || (n.edition === "first edition" && t.includes("1st"))) score += 15;
    else if (identity.edition) {
      return { score, accepted: false, fatalReason: "Edition mismatch", warnings };
    }
  }

  if (n.finish) {
    if (t.includes(n.finish) || (n.finish === "holo" && t.includes("holofoil"))) score += 10;
    else if (identity.finish) warnings.push("Finish not explicit in title");
  }

  if (n.language && t.includes(n.language.split(" ")[0]!)) score += 5;

  if (identity.conditionType === "raw") score += 5;
  else {
    if (n.grader && t.includes(n.grader)) score += 5;
    if (n.grade && t.includes(n.grade)) score += 5;
  }

  const accepted =
    score >= 85 &&
    (!n.cardNumberParts.num || cardNumberVariants(identity.cardNumber ?? "").some((v) => t.includes(v))) &&
    (!identity.edition || t.includes(n.edition) || (n.edition === "first edition" && t.includes("1st")));

  return { score, accepted, warnings };
}

export function normaliseCondition(text: string): import("./types.js").ConditionNormalised {
  const t = normaliseText(text);
  if (!t) return "unspecified";
  if (/mint|gem mint|nm mint/.test(t) && !/near/.test(t)) return "mint";
  if (/near mint|\bnm\b/.test(t)) return "near_mint";
  if (/excellent|\bex\b/.test(t)) return "excellent";
  if (/lightly played|\blp\b/.test(t)) return "lightly_played";
  if (/very good|\bvg\b/.test(t)) return "very_good";
  if (/moderately played|\bmp\b/.test(t)) return "moderately_played";
  if (/heavily played|\bhp\b/.test(t)) return "heavily_played";
  if (/played|\bpoor\b/.test(t)) return "poor";
  if (/damaged/.test(t)) return "damaged";
  return "unspecified";
}
