const BASE = "https://www.pricecharting.com";

import type { MarketComp } from "./marketComps.js";

export function isPriceChartingConfigured(): boolean {
  return Boolean(process.env.PRICECHARTING_API_TOKEN);
}

function token(): string {
  return process.env.PRICECHARTING_API_TOKEN || "";
}

function usdCentsToGbp(cents: number): number {
  const rate = Number(process.env.USD_TO_GBP || "0.79");
  return Math.round((cents / 100) * rate * 100) / 100;
}

function parseCents(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export interface PriceChartingProduct {
  id: string;
  name: string;
  consoleName: string;
  looseCents: number | null;
  /** All known grade price columns (USD cents). */
  gradeCents: Record<string, number>;
}

function buildQuery(parts: { name?: string; set?: string; number?: string }): string {
  return [parts.name, parts.set, parts.number ? `#${parts.number}` : ""]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function scoreProduct(
  product: { name: string; consoleName: string },
  parts: { name?: string; set?: string; number?: string }
): number {
  const pn = product.name.toLowerCase();
  const cn = product.consoleName.toLowerCase();
  const name = (parts.name ?? "").toLowerCase();
  const set = (parts.set ?? "").toLowerCase();
  const num = (parts.number ?? "").replace(/^0+/, "");
  let score = 0;
  if (name && pn.includes(name)) score += 3;
  for (const w of name.split(/\s+/).filter((x) => x.length > 2)) {
    if (pn.includes(w)) score += 1;
  }
  if (set && (pn.includes(set) || cn.includes(set))) score += 2;
  if (num && (pn.includes(`#${num}`) || pn.includes(` ${num}`) || pn.endsWith(num))) score += 3;
  if (/pokemon|tcg|card/i.test(cn)) score += 1;
  return score;
}

const GRADE_PRICE_KEYS = [
  "loose-price",
  "graded-price",
  "new-price",
  "cib-price",
  "box-only-price",
  "manual-only-price",
  "bgs-10-price",
  "condition-17-price",
  "condition-18-price",
] as const;

function parseProductRow(data: Record<string, unknown>): PriceChartingProduct | null {
  const id = String(data.id ?? "").trim();
  const name = String(data["product-name"] ?? "").trim();
  if (!id || !name) return null;

  const gradeCents: Record<string, number> = {};
  for (const key of GRADE_PRICE_KEYS) {
    const cents = parseCents(data[key]);
    if (cents != null && cents > 0) gradeCents[key] = cents;
  }

  return {
    id,
    name,
    consoleName: String(data["console-name"] ?? "").trim(),
    looseCents: parseCents(data["loose-price"]),
    gradeCents,
  };
}

/** Search then fetch the best-matching product with full grade columns. */
export async function fetchPriceChartingProduct(parts: {
  name?: string;
  set?: string;
  number?: string;
}): Promise<PriceChartingProduct | null> {
  if (!isPriceChartingConfigured()) return null;
  const q = buildQuery(parts);
  if (!q) return null;

  const searchUrl = `${BASE}/api/products?t=${encodeURIComponent(token())}&q=${encodeURIComponent(q)}`;
  const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(12000) });
  if (searchRes.ok) {
    const searchData = (await searchRes.json()) as {
      status?: string;
      products?: Record<string, unknown>[];
    };
    if (searchData.status !== "error" && Array.isArray(searchData.products)) {
      let best: { id: string; score: number } | null = null;
      for (const row of searchData.products) {
        const id = String(row.id ?? "");
        const name = String(row["product-name"] ?? "");
        if (!id || !name) continue;
        const score = scoreProduct(
          { name, consoleName: String(row["console-name"] ?? "") },
          parts
        );
        if (!best || score > best.score) best = { id, score };
      }
      if (best && best.score >= 3) {
        const detail = await fetchPriceChartingById(best.id);
        if (detail) return detail;
      }
    }
  }

  const url = `${BASE}/api/product?t=${encodeURIComponent(token())}&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) return null;
  const data = (await res.json()) as Record<string, unknown>;
  if (data.status === "error") return null;
  return parseProductRow(data);
}

async function fetchPriceChartingById(id: string): Promise<PriceChartingProduct | null> {
  const url = `${BASE}/api/product?t=${encodeURIComponent(token())}&id=${encodeURIComponent(id)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) return null;
  const data = (await res.json()) as Record<string, unknown>;
  if (data.status === "error") return null;
  return parseProductRow(data);
}

/** Map a likely grade to PriceCharting column keys (cards taxonomy). */
function pcKeysForGrade(company: string, gradeLabel: string): string[] {
  const co = company.toLowerCase();
  const g = gradeLabel.replace(/[^\d.]/g, "");
  const gradeNum = parseFloat(g);
  const keys: string[] = [];

  if (/black label|pristine|gem mint|10\b/i.test(gradeLabel) || gradeNum >= 9.5) {
    if (co.includes("psa") || co.includes("tag") || co.includes("ace")) keys.push("manual-only-price");
    if (co.includes("beckett") || co.includes("bgs")) keys.push("bgs-10-price");
    if (co.includes("cgc")) keys.push("condition-17-price");
    if (co.includes("sgc")) keys.push("condition-18-price");
  } else if (gradeNum >= 9) {
    keys.push("graded-price");
    if (co.includes("beckett") || co.includes("bgs")) keys.push("box-only-price");
  } else if (gradeNum >= 8) {
    keys.push("new-price");
    keys.push("graded-price");
  } else if (gradeNum >= 7) {
    keys.push("cib-price");
  }

  return keys;
}

export function gradedGbpFromProduct(
  product: PriceChartingProduct,
  company: string,
  gradeLabel: string
): { low: number; high: number; median: number; pcKey: string } | null {
  const keys = pcKeysForGrade(company, gradeLabel);
  for (const key of keys) {
    const cents = product.gradeCents[key];
    if (cents == null || cents <= 0) continue;
    const mid = usdCentsToGbp(cents);
    const spread = Math.max(0.06 * mid, 0.5);
    return {
      median: mid,
      low: Math.round((mid - spread) * 100) / 100,
      high: Math.round((mid + spread) * 100) / 100,
      pcKey: key,
    };
  }
  return null;
}

export function rawGbpFromProduct(
  product: PriceChartingProduct
): { low: number; high: number; median: number } | null {
  const cents = product.looseCents;
  if (cents == null || cents <= 0) return null;
  const mid = usdCentsToGbp(cents);
  const spread = Math.max(0.08 * mid, 0.5);
  return {
    median: mid,
    low: Math.round((mid - spread) * 100) / 100,
    high: Math.round((mid + spread) * 100) / 100,
  };
}

/** Emit MarketComp rows from a matched PriceCharting product. */
export function compsFromPriceChartingProduct(
  product: PriceChartingProduct,
  gradedTargets: { company: string; grade: string }[]
): MarketComp[] {
  const comps: MarketComp[] = [];
  const raw = rawGbpFromProduct(product);
  if (raw) {
    comps.push({
      source: "pricecharting",
      kind: "raw",
      priceGbp: raw.median,
      label: `${product.name} · ungraded (PC)`,
    });
  }
  for (const g of gradedTargets) {
    const band = gradedGbpFromProduct(product, g.company, g.grade);
    if (!band) continue;
    comps.push({
      source: "pricecharting",
      kind: "graded",
      priceGbp: band.median,
      company: g.company,
      grade: g.grade,
      label: `${product.name} · ${band.pcKey}`,
    });
  }
  return comps;
}
