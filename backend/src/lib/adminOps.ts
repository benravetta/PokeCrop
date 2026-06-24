import { getServiceClient } from "./supabase.js";

export interface FormSubmissionRow {
  id: string;
  kind: string;
  email: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export async function listFormSubmissions(opts: {
  page?: number;
  pageSize?: number;
  kind?: string;
}): Promise<{ submissions: FormSubmissionRow[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 25));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = getServiceClient()
    .from("form_submissions")
    .select("id, kind, email, payload, created_at", { count: "exact" })
    .order("created_at", { ascending: false });

  if (opts.kind) q = q.eq("kind", opts.kind);

  const { data, count, error } = await q.range(from, to);
  if (error) throw error;

  const submissions: FormSubmissionRow[] = (data ?? []).map((r) => ({
    id: String(r.id ?? ""),
    kind: String(r.kind ?? ""),
    email: (r.email as string | null) ?? null,
    payload: (r.payload as Record<string, unknown>) ?? {},
    createdAt: String(r.created_at ?? ""),
  }));

  return { submissions, total: count ?? 0, page, pageSize };
}

export interface StripeEventRow {
  id: string;
  type: string;
  createdAt: string;
}

export async function listStripeEvents(opts: {
  page?: number;
  pageSize?: number;
}): Promise<{ events: StripeEventRow[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 50));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, count, error } = await getServiceClient()
    .from("stripe_events")
    .select("id, type, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw error;

  const events: StripeEventRow[] = (data ?? []).map((r) => ({
    id: String(r.id ?? ""),
    type: String(r.type ?? ""),
    createdAt: String(r.created_at ?? ""),
  }));

  return { events, total: count ?? 0, page, pageSize };
}

export async function listUserPurchases(userId: string, limit = 10) {
  const { data, error } = await getServiceClient()
    .from("grade_purchases")
    .select("id, qty, status, credited_at, refunded_at, stripe_session_id")
    .eq("user_id", userId)
    .order("credited_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as number,
    qty: (r.qty as number) ?? 1,
    status: String(r.status ?? ""),
    creditedAt: (r.credited_at as string | null) ?? null,
    refundedAt: (r.refunded_at as string | null) ?? null,
    stripeSessionId: (r.stripe_session_id as string | null) ?? null,
  }));
}
