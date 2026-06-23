import { chatComplete, isOpenAiConfigured } from "./openai.js";

// Rough, AI-estimated market value for an identified card: a raw/ungraded range
// plus a graded range per supported grader (at that grader's likely grade).
// These are ballpark figures from the model's general knowledge — NOT live
// market data — and are surfaced with a clear estimate disclaimer.
const MODEL = process.env.CARD_PRICE_MODEL || "gpt-4o";

export interface PriceRange {
  low: number;
  high: number;
}

export interface GradedPrice {
  company: string;
  grade: string;
  low: number;
  high: number;
}

export interface CardPricing {
  currency: string; // ISO-ish code, e.g. "GBP"
  raw: PriceRange;
  graded: GradedPrice[];
  confidence: "low" | "medium" | "high";
  note: string;
  /** Where the numbers came from — shown on reports. */
  source?: "cardmarket" | "pricecharting" | "mixed" | "ai";
  rawSource?: "cardmarket" | "pricecharting";
  /** ISO date (YYYY-MM-DD) the market data was fetched. */
  asOf?: string;
}

export interface PriceIdentity {
  name?: unknown;
  set?: unknown;
  number?: unknown;
  variant?: unknown;
  language?: unknown;
  confidence?: unknown;
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

function toNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

const SYSTEM =
  "You are a trading-card market analyst for a UK audience. You give realistic, " +
  "current ballpark resale values in GBP (£). You are conservative and never " +
  "hype prices. You return ranges, not single prices, and you output ONLY a " +
  "strict JSON object.";

interface CompanyLikely {
  company: string;
  grade: string;
}

// Pull the supported-company likely grades out of the adjudicator's
// company_estimates array.
export function companyLikelyGrades(companyEstimates: unknown): CompanyLikely[] {
  if (!Array.isArray(companyEstimates)) return [];
  const out: CompanyLikely[] = [];
  for (const c of companyEstimates) {
    if (!c || typeof c !== "object") continue;
    const o = c as Record<string, unknown>;
    const company = str(o.company);
    const grade = str(o.likely);
    if (company && grade && !/authentic|altered/i.test(grade)) {
      out.push({ company, grade });
    }
  }
  return out;
}

// Estimate prices for an identified card. Returns null when OpenAI is not
// configured, the card is not confidently identified, or the model fails.
export async function estimateCardPrices(
  identity: PriceIdentity,
  companyEstimates: unknown,
  userId: string,
  opts: { timeoutMs?: number } = {}
): Promise<CardPricing | null> {
  if (!isOpenAiConfigured()) return null;

  const name = str(identity.name);
  const idConfidence = str(identity.confidence).toLowerCase();
  // Don't invent prices for an unidentified or barely-identified card.
  if (!name || idConfidence === "low") return null;

  const graded = companyLikelyGrades(companyEstimates);

  const cardDesc = [
    `name: ${name}`,
    str(identity.set) ? `set: ${str(identity.set)}` : "",
    str(identity.number) ? `number: ${str(identity.number)}` : "",
    str(identity.variant) ? `variant: ${str(identity.variant)}` : "",
    str(identity.language) ? `language: ${str(identity.language)}` : "",
  ]
    .filter(Boolean)
    .join(", ");

  const gradedList = graded.length
    ? graded.map((g) => `${g.company} at ${g.grade}`).join("; ")
    : "(no graded estimates available — return an empty graded array)";

  const prompt =
    `Estimate the current UK resale value in GBP for this trading card.\n` +
    `Card: ${cardDesc}.\n` +
    `Provide a raw/ungraded range, and a graded range for each of: ${gradedList}.\n` +
    `Use realistic recent secondary-market levels (eBay UK sold, marketplace listings). ` +
    `Graded values must reflect the specific company AND the stated grade. ` +
    `If you are unsure of the exact card/printing, widen the ranges and lower confidence rather than guessing precisely.\n` +
    `Return ONLY this JSON shape (numbers are GBP, no symbols):\n` +
    `{\n` +
    `  "currency": "GBP",\n` +
    `  "raw": { "low": 0, "high": 0 },\n` +
    `  "graded": [ { "company": "PSA", "grade": "PSA 9", "low": 0, "high": 0 } ],\n` +
    `  "confidence": "low|medium|high",\n` +
    `  "note": "one short caveat sentence"\n` +
    `}`;

  const res = await chatComplete({
    model: MODEL,
    system: SYSTEM,
    user: prompt,
    jsonObject: true,
    maxTokens: 600,
    temperature: 0,
    feature: "card_pricing",
    userId,
    timeoutMs: opts.timeoutMs ?? 20000,
  });
  if (!res) return null;

  let parsed: Record<string, unknown>;
  try {
    const v = JSON.parse(res.content);
    if (!v || typeof v !== "object") return null;
    parsed = v as Record<string, unknown>;
  } catch {
    return null;
  }

  const rawObj = (parsed.raw && typeof parsed.raw === "object" ? parsed.raw : {}) as Record<
    string,
    unknown
  >;
  const rawLow = toNum(rawObj.low);
  const rawHigh = toNum(rawObj.high);
  if (rawLow == null || rawHigh == null) return null;

  const gradedOut: GradedPrice[] = [];
  if (Array.isArray(parsed.graded)) {
    for (const g of parsed.graded) {
      if (!g || typeof g !== "object") continue;
      const o = g as Record<string, unknown>;
      const company = str(o.company);
      const low = toNum(o.low);
      const high = toNum(o.high);
      if (!company || low == null || high == null) continue;
      gradedOut.push({
        company,
        grade: str(o.grade),
        low: Math.min(low, high),
        high: Math.max(low, high),
      });
    }
  }

  const confRaw = str(parsed.confidence).toLowerCase();
  const confidence: CardPricing["confidence"] =
    confRaw === "high" ? "high" : confRaw === "medium" ? "medium" : "low";

  return {
    currency: str(parsed.currency) || "GBP",
    raw: { low: Math.min(rawLow, rawHigh), high: Math.max(rawLow, rawHigh) },
    graded: gradedOut,
    confidence,
    note: str(parsed.note),
  };
}
