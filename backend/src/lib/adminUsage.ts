import { getServiceClient } from "./supabase.js";
import { emailByUserIds } from "./adminEmails.js";

export interface AdminUsageEventRow {
  id: number;
  userId: string;
  email: string | null;
  kind: string;
  source: string;
  billing: string;
  plan: string | null;
  summary: string | null;
  createdAt: string;
}

export async function listUsageEvents(opts: {
  page?: number;
  pageSize?: number;
  kind?: string;
  billing?: string;
  source?: string;
  from?: string;
  to?: string;
  userId?: string;
}): Promise<{ events: AdminUsageEventRow[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 50));
  const fromIdx = (page - 1) * pageSize;
  const toIdx = fromIdx + pageSize - 1;

  let q = getServiceClient()
    .from("usage_events")
    .select("id, user_id, kind, source, billing, plan, summary, created_at", { count: "exact" })
    .order("created_at", { ascending: false });

  if (opts.kind) q = q.eq("kind", opts.kind);
  if (opts.billing) q = q.eq("billing", opts.billing);
  if (opts.source) q = q.eq("source", opts.source);
  if (opts.userId) q = q.eq("user_id", opts.userId);
  if (opts.from) q = q.gte("created_at", opts.from);
  if (opts.to) q = q.lte("created_at", opts.to);

  const { data, count, error } = await q.range(fromIdx, toIdx);
  if (error) throw error;

  const userIds = [...new Set((data ?? []).map((r) => r.user_id as string))];
  const emails = await emailByUserIds(userIds);

  const events: AdminUsageEventRow[] = (data ?? []).map((r) => ({
    id: r.id as number,
    userId: r.user_id as string,
    email: emails.get(r.user_id as string) ?? null,
    kind: String(r.kind ?? ""),
    source: String(r.source ?? ""),
    billing: String(r.billing ?? ""),
    plan: (r.plan as string | null) ?? null,
    summary: (r.summary as string | null) ?? null,
    createdAt: String(r.created_at ?? ""),
  }));

  return { events, total: count ?? 0, page, pageSize };
}

export async function exportUsageEventsCsv(opts: {
  kind?: string;
  billing?: string;
  source?: string;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<string> {
  const cap = Math.min(opts.limit ?? 10_000, 10_000);
  let q = getServiceClient()
    .from("usage_events")
    .select("id, user_id, kind, source, billing, plan, summary, created_at")
    .order("created_at", { ascending: false })
    .limit(cap);

  if (opts.kind) q = q.eq("kind", opts.kind);
  if (opts.billing) q = q.eq("billing", opts.billing);
  if (opts.source) q = q.eq("source", opts.source);
  if (opts.from) q = q.gte("created_at", opts.from);
  if (opts.to) q = q.lte("created_at", opts.to);

  const { data, error } = await q;
  if (error) throw error;

  const header = "id,user_id,kind,source,billing,plan,summary,created_at\n";
  const rows = (data ?? [])
    .map((r) =>
      [
        r.id,
        r.user_id,
        csvCell(r.kind),
        csvCell(r.source),
        csvCell(r.billing),
        csvCell(r.plan),
        csvCell(r.summary),
        csvCell(r.created_at),
      ].join(",")
    )
    .join("\n");
  return header + rows;
}

function csvCell(v: unknown): string {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function listUserUsageEvents(
  userId: string,
  limit = 20
): Promise<AdminUsageEventRow[]> {
  const { events } = await listUsageEvents({ userId, pageSize: limit, page: 1 });
  return events;
}
