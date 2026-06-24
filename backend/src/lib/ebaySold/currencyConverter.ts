/** Application-controlled FX rates — no currency API. */

export interface ExchangeRateEntry {
  rateToGbp: number;
  updatedAt: string;
  sourceDescription: string;
}

export type ExchangeRateTable = Record<string, ExchangeRateEntry>;

const DEFAULT_RATES: ExchangeRateTable = {
  GBP: { rateToGbp: 1, updatedAt: "2026-06-01", sourceDescription: "GemCheck default config" },
  USD: { rateToGbp: 0.79, updatedAt: "2026-06-01", sourceDescription: "GemCheck default config" },
  EUR: { rateToGbp: 0.85, updatedAt: "2026-06-01", sourceDescription: "GemCheck default config" },
  CAD: { rateToGbp: 0.58, updatedAt: "2026-06-01", sourceDescription: "GemCheck default config" },
  AUD: { rateToGbp: 0.52, updatedAt: "2026-06-01", sourceDescription: "GemCheck default config" },
  JPY: { rateToGbp: 0.005, updatedAt: "2026-06-01", sourceDescription: "GemCheck default config" },
};

const STALE_DAYS = Number(process.env.EXCHANGE_RATE_STALE_DAYS || "30");

let cachedTable: ExchangeRateTable | null = null;

function loadTable(): ExchangeRateTable {
  if (cachedTable) return cachedTable;
  const raw = process.env.EXCHANGE_RATES_JSON;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, { rateToGbp?: number; updatedAt?: string; sourceDescription?: string }>;
      const table: ExchangeRateTable = { ...DEFAULT_RATES };
      for (const [cur, entry] of Object.entries(parsed)) {
        if (entry?.rateToGbp && Number.isFinite(entry.rateToGbp)) {
          table[cur.toUpperCase()] = {
            rateToGbp: entry.rateToGbp,
            updatedAt: entry.updatedAt ?? new Date().toISOString().slice(0, 10),
            sourceDescription: entry.sourceDescription ?? "EXCHANGE_RATES_JSON",
          };
        }
      }
      cachedTable = table;
      return table;
    } catch {
      console.error("Invalid EXCHANGE_RATES_JSON; using defaults.");
    }
  }
  cachedTable = DEFAULT_RATES;
  return DEFAULT_RATES;
}

export function normaliseCurrency(code: string): string {
  const c = code.trim().toUpperCase();
  if (c === "US" || c === "US$") return "USD";
  if (c === "£" || c === "GBP") return "GBP";
  if (c === "€" || c === "EUR") return "EUR";
  if (c === "AU$" || c === "AUD") return "AUD";
  if (c === "C$" || c === "CAD") return "CAD";
  if (c === "JP¥" || c === "JPY") return "JPY";
  return c.replace(/[^A-Z]/g, "") || "GBP";
}

export function isRateStale(entry: ExchangeRateEntry): boolean {
  const updated = Date.parse(entry.updatedAt);
  if (!Number.isFinite(updated)) return true;
  return Date.now() - updated > STALE_DAYS * 86400_000;
}

export function convertToGbp(
  amount: number,
  currency: string
): { gbp: number; rate: number; stale: boolean } | null {
  const cur = normaliseCurrency(currency);
  const table = loadTable();
  const entry = table[cur];
  if (!entry) return null;
  const gbp = Math.round(amount * entry.rateToGbp * 100) / 100;
  return { gbp, rate: entry.rateToGbp, stale: isRateStale(entry) };
}

export function getExchangeRateTable(): ExchangeRateTable {
  return loadTable();
}

/** Reset cached table (tests). */
export function resetExchangeRatesForTests(): void {
  cachedTable = null;
}
