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
  currency: string;
  raw: PriceRange;
  graded: GradedPrice[];
  confidence: "low" | "medium" | "high";
  note: string;
  source?: "cardmarket" | "pricecharting" | "ebay" | "mixed" | "ai";
  rawSource?: "cardmarket" | "pricecharting" | "ebay";
  asOf?: string;
  compCount?: number;
  /** Full eBay sold lookup payload when available. */
  ebaySold?: import("./ebaySold/types.js").EbaySoldValuation;
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

interface CompanyLikely {
  company: string;
  grade: string;
}

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

/** @deprecated Use marketPricing.ts (AI web research) */
export async function estimateCardPrices(
  _identity: PriceIdentity,
  _companyEstimates: unknown,
  _userId: string,
  _opts: { timeoutMs?: number } = {}
): Promise<CardPricing | null> {
  return null;
}
