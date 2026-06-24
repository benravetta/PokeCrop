import { getServiceClient } from "./supabase.js";

// Per-user activity / audit event stream. Rows are pruned to a 2-day window by
// a daily cron job (see the admin_activity_log migration), so the table stays
// small and reads stay fast. Writes are fire-and-forget — auditing must never
// add latency to (or fail) the request that triggered it.

export type ActivityAction =
  | "crop.web"
  | "crop.api"
  | "grade.web"
  | "grade.api"
  | "grade.web.not_a_card"
  | "grade.api.not_a_card"
  | "grade.credit.purchased"
  | "grade.credit.refunded"
  | "grade.credit.refund_no_balance"
  | "grade.purchase.async_failed"
  | "grade.purchase.disputed"
  | "grade.purchase.dispute_won"
  | "grade.checkout.expired"
  | "key.created"
  | "key.revoked"
  | "plan.changed"
  | "role.changed"
  | "account.suspended"
  | "account.reinstated"
  | "key_limit.changed"
  | "subscription.synced";

export interface ActivityInput {
  /** Whose timeline this event belongs to. */
  userId: string;
  action: ActivityAction;
  /** Who performed the action; null/undefined means system (e.g. Stripe). */
  actorId?: string | null;
  /** Denormalised actor email for display without an extra lookup. */
  actorEmail?: string | null;
  detail?: Record<string, unknown> | null;
}

export interface ActivityEvent {
  id: number;
  user_id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  detail: Record<string, unknown> | null;
  created_at: string;
}

const SELECT_COLS = "id, user_id, actor_id, actor_email, action, detail, created_at";

export const DEFAULT_RECENT = 10;
// Hard cap on a single export. With 2-day retention this comfortably covers
// even heavy API users while bounding memory and response size.
export const MAX_EXPORT_ROWS = 10000;

// Record an event without blocking the caller. Failures are logged, not thrown.
export function logActivity(input: ActivityInput): void {
  getServiceClient()
    .from("activity_log")
    .insert({
      user_id: input.userId,
      actor_id: input.actorId ?? null,
      actor_email: input.actorEmail ?? null,
      action: input.action,
      detail: input.detail ?? null,
    })
    .then(
      () => {},
      (err: unknown) => console.error("logActivity failed:", err)
    );
}

export async function recentActivity(
  userId: string,
  limit: number = DEFAULT_RECENT
): Promise<ActivityEvent[]> {
  const capped = Math.min(Math.max(Math.trunc(limit) || DEFAULT_RECENT, 1), 200);
  const { data, error } = await getServiceClient()
    .from("activity_log")
    .select(SELECT_COLS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(capped);
  if (error) throw error;
  return (data ?? []) as ActivityEvent[];
}

export async function allActivity(userId: string): Promise<ActivityEvent[]> {
  const { data, error } = await getServiceClient()
    .from("activity_log")
    .select(SELECT_COLS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(MAX_EXPORT_ROWS);
  if (error) throw error;
  return (data ?? []) as ActivityEvent[];
}

// RFC-4180-ish CSV for the full-log download. Cells are quoted, and any cell
// beginning with a spreadsheet formula trigger (= + - @, tab, CR) is prefixed
// with a single quote to neutralise CSV/formula injection — actor_email and
// other fields can carry user-controlled text.
export function activityToCsv(rows: ActivityEvent[]): string {
  const esc = (raw: string): string => {
    let v = raw;
    if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
    return `"${v.replace(/"/g, '""')}"`;
  };
  const lines = ["created_at,action,actor_email,detail"];
  for (const r of rows) {
    lines.push(
      [
        esc(r.created_at),
        esc(r.action),
        esc(r.actor_email ?? ""),
        esc(r.detail ? JSON.stringify(r.detail) : ""),
      ].join(",")
    );
  }
  return lines.join("\r\n");
}
