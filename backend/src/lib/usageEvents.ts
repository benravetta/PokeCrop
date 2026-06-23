import { getServiceClient } from "./supabase.js";

// Per-user history of every crop and grade, kept indefinitely (unlike the
// 2-day activity_log). Distinguishes how the action was paid for and snapshots
// the quota at the moment of the event, so a user can see — for a subscription
// grade — which number it was and how many remained at the time.

export type UsageKind = "crop" | "grade";
export type UsageSource = "web" | "api";
export type UsageBilling = "free" | "subscription" | "one_off";

export interface UsageEventInput {
  userId: string;
  kind: UsageKind;
  source?: UsageSource;
  billing: UsageBilling;
  plan?: string | null;
  window?: "day" | "month" | null;
  /** The Nth use within the window (e.g. grade 3 of 10). */
  usedAfter?: number | null;
  /** Allowance/credits remaining immediately after this event. */
  remainingAfter?: number | null;
  /** Short, searchable label (card name or filename). */
  summary?: string | null;
  detail?: Record<string, unknown> | null;
}

export interface UsageEvent {
  id: number;
  kind: UsageKind;
  source: UsageSource;
  billing: UsageBilling;
  plan: string | null;
  quota_window: "day" | "month" | null;
  used_after: number | null;
  remaining_after: number | null;
  summary: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
}

const SELECT_COLS =
  "id, kind, source, billing, plan, quota_window, used_after, remaining_after, summary, detail, created_at";

// Record a usage event. Fire-and-forget: history must never add latency to (or
// fail) the crop/grade request that triggered it.
export function logUsageEvent(input: UsageEventInput): void {
  getServiceClient()
    .from("usage_events")
    .insert({
      user_id: input.userId,
      kind: input.kind,
      source: input.source ?? "web",
      billing: input.billing,
      plan: input.plan ?? null,
      quota_window: input.window ?? null,
      used_after: input.usedAfter ?? null,
      remaining_after: input.remainingAfter ?? null,
      summary: input.summary ?? null,
      detail: input.detail ?? null,
    })
    .then(
      () => {},
      (err: unknown) => console.error("logUsageEvent failed:", err)
    );
}

export interface HistoryQuery {
  userId: string;
  kind?: UsageKind;
  source?: UsageSource;
  /** Free-text search over the summary label. */
  q?: string;
  /** ISO date (inclusive lower bound) on created_at. */
  from?: string;
  /** ISO date (exclusive upper bound) on created_at. */
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface HistoryResult {
  events: UsageEvent[];
  total: number;
  page: number;
  pageSize: number;
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export async function getHistory(query: HistoryQuery): Promise<HistoryResult> {
  const page = Math.max(1, Math.trunc(query.page || 1));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.trunc(query.pageSize || DEFAULT_PAGE_SIZE))
  );
  const fromIdx = (page - 1) * pageSize;
  const toIdx = fromIdx + pageSize - 1;

  let q = getServiceClient()
    .from("usage_events")
    .select(SELECT_COLS, { count: "exact" })
    .eq("user_id", query.userId);

  if (query.kind) q = q.eq("kind", query.kind);
  if (query.source) q = q.eq("source", query.source);
  if (query.q && query.q.trim()) {
    // Escape PostgREST ilike wildcards/commas in user input.
    const safe = query.q.trim().replace(/[%,]/g, " ");
    q = q.ilike("summary", `%${safe}%`);
  }
  if (query.from) q = q.gte("created_at", query.from);
  if (query.to) q = q.lt("created_at", query.to);

  const { data, error, count } = await q
    .order("created_at", { ascending: false })
    .range(fromIdx, toIdx);
  if (error) throw error;

  return {
    events: (data ?? []) as unknown as UsageEvent[],
    total: count ?? 0,
    page,
    pageSize,
  };
}
