const PLANS = new Set(["free", "unlimited", "pro", "api"]);
const SUB_STATUSES = new Set(["active", "trialing", "canceled", "past_due", "unpaid"]);
const PURCHASE_STATUSES = new Set(["completed", "refunded", "disputed"]);
const USAGE_KINDS = new Set(["crop", "grade"]);
const USAGE_BILLING = new Set(["free", "subscription", "one_off", "admin"]);
const USAGE_SOURCES = new Set(["web", "api"]);
const INVOICE_STATUSES = new Set([
  "draft",
  "open",
  "paid",
  "uncollectible",
  "void",
]);

export function parsePlan(v: unknown): string | null {
  if (typeof v !== "string" || !v) return null;
  return PLANS.has(v) ? v : null;
}

export function parseSubStatus(v: unknown): string | null {
  if (typeof v !== "string" || !v) return null;
  return SUB_STATUSES.has(v) ? v : null;
}

export function parsePurchaseStatus(v: unknown): string | null {
  if (typeof v !== "string" || !v) return null;
  return PURCHASE_STATUSES.has(v) ? v : null;
}

export function parseUsageKind(v: unknown): string | undefined {
  if (typeof v !== "string" || !v) return undefined;
  return USAGE_KINDS.has(v) ? v : undefined;
}

export function parseUsageBilling(v: unknown): string | undefined {
  if (typeof v !== "string" || !v) return undefined;
  return USAGE_BILLING.has(v) ? v : undefined;
}

export function parseUsageSource(v: unknown): string | undefined {
  if (typeof v !== "string" || !v) return undefined;
  return USAGE_SOURCES.has(v) ? v : undefined;
}

export function parseInvoiceStatus(v: unknown): string | undefined {
  if (typeof v !== "string" || !v) return undefined;
  return INVOICE_STATUSES.has(v) ? v : undefined;
}

export function parseIsoDate(v: unknown): string | undefined {
  if (typeof v !== "string" || !v) return undefined;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseUuid(v: unknown): string | undefined {
  if (typeof v !== "string" || !UUID_RE.test(v)) return undefined;
  return v;
}

export function parseDays(v: unknown, defaultDays = 30, maxDays = 180): number {
  const n = parseInt(String(v ?? defaultDays), 10);
  const days = Number.isFinite(n) ? n : defaultDays;
  return Math.min(Math.max(days, 1), maxDays);
}

const FORM_KINDS = new Set(["contact", "trade"]);

export function parseFormKind(v: unknown): string | undefined {
  if (typeof v !== "string" || !v) return undefined;
  return FORM_KINDS.has(v) ? v : undefined;
}
