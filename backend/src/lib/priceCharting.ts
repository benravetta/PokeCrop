const BASE = "https://www.pricecharting.com";

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
  gradedCents: number | null;
  psa10Cents: number | null;
}

function buildQuery(parts: { name?: string; set?: string; number?: string }): string {
  return [parts.name, parts.set, parts.number ? `#${parts.number}` : ""]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

/** Search PriceCharting for a single best-match product. */
export async function fetchPriceChartingProduct(parts: {
  name?: string;
  set?: string;
  number?: string;
}): Promise<PriceChartingProduct | null> {
  if (!isPriceChartingConfigured()) return null;
  const q = buildQuery(parts);
  if (!q) return null;

  const url = `${BASE}/api/product?t=${encodeURIComponent(token())}&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) return null;

  const data = (await res.json()) as Record<string, unknown>;
  if (data.status === "error") return null;

  const id = String(data.id ?? "").trim();
  const name = String(data["product-name"] ?? "").trim();
  if (!id || !name) return null;

  return {
    id,
    name,
    consoleName: String(data["console-name"] ?? "").trim(),
    looseCents: parseCents(data["loose-price"]),
    gradedCents: parseCents(data["graded-price"]),
    psa10Cents: parseCents(data["manual-only-price"]),
  };
}

/** Map a likely grade string to PriceCharting price columns (USD cents → GBP). */
export function gradedGbpFromProduct(
  product: PriceChartingProduct,
  company: string,
  gradeLabel: string
): { low: number; high: number } | null {
  const g = gradeLabel.replace(/[^\d.]/g, "");
  const gradeNum = parseFloat(g);
  if (!Number.isFinite(gradeNum)) return null;

  let cents: number | null = null;
  const co = company.toLowerCase();

  if (gradeNum >= 9.5 || /black label|pristine|gem mint 10|psa 10|tag 10|ace 10/i.test(gradeLabel)) {
    cents = product.psa10Cents ?? product.gradedCents;
  } else if (gradeNum >= 8.5) {
    cents = product.gradedCents ?? product.psa10Cents;
  } else if (gradeNum >= 7 && (co.includes("psa") || co.includes("beckett") || co.includes("cgc"))) {
    cents = product.gradedCents ?? product.looseCents;
  }

  if (cents == null || cents <= 0) return null;

  const mid = usdCentsToGbp(cents);
  const spread = Math.max(0.08 * mid, 0.5);
  return {
    low: Math.round((mid - spread) * 100) / 100,
    high: Math.round((mid + spread) * 100) / 100,
  };
}

export function rawGbpFromProduct(product: PriceChartingProduct): { low: number; high: number } | null {
  const cents = product.looseCents;
  if (cents == null || cents <= 0) return null;
  const mid = usdCentsToGbp(cents);
  const spread = Math.max(0.1 * mid, 0.5);
  return {
    low: Math.round((mid - spread) * 100) / 100,
    high: Math.round((mid + spread) * 100) / 100,
  };
}
