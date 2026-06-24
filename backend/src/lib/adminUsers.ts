import type { User } from "@supabase/supabase-js";
import { getServiceClient } from "./supabase.js";

const PAID_PLANS = new Set(["unlimited", "pro", "api"]);
const ACTIVE_STATUSES = new Set(["active", "trialing"]);

export interface AdminUserListOpts {
  page: number;
  perPage: number;
  query?: string;
  plan?: string | null;
  status?: string | null;
  suspended?: boolean | null;
  role?: "admin" | "user" | null;
}

export interface AdminUserListRow {
  id: string;
  email: string | undefined;
  role: "user" | "admin";
  created_at: string;
  suspended: boolean;
  plan: string;
  status: string | null;
  current_period_end: string | null;
  cropsUsedToday: number;
}

function roleOf(appMetadata: unknown): "user" | "admin" {
  return (appMetadata as Record<string, unknown> | undefined)?.role === "admin"
    ? "admin"
    : "user";
}

function isSuspendedNow(bannedUntil: string | null | undefined): boolean {
  return Boolean(bannedUntil && new Date(bannedUntil) > new Date());
}

function bannedUntilOf(u: User): string | null | undefined {
  return (u as unknown as { banned_until?: string | null }).banned_until;
}

function matchesQuery(u: User, query: string): boolean {
  return (u.email ?? "").toLowerCase().includes(query);
}

function matchesRole(u: User, role: "admin" | "user"): boolean {
  return roleOf(u.app_metadata) === role;
}

function matchesSuspended(u: User, suspended: boolean): boolean {
  return isSuspendedNow(bannedUntilOf(u)) === suspended;
}

function effectivePlan(sub?: {
  plan: string;
  status: string | null;
}): string {
  if (!sub) return "free";
  return sub.plan ?? "free";
}

function matchesPlan(
  sub: { plan: string; status: string | null } | undefined,
  planFilter: string
): boolean {
  const plan = effectivePlan(sub);
  if (planFilter === "free") {
    if (plan === "free") return true;
    if (!sub) return true;
    // Canceled or inactive paid rows still list the paid plan in the UI;
    // treat them as not free for the free filter.
    return false;
  }
  if (!sub) return false;
  if (sub.plan !== planFilter) return false;
  if (PAID_PLANS.has(planFilter) && !ACTIVE_STATUSES.has(sub.status ?? "")) {
    return false;
  }
  return true;
}

function matchesStatus(
  sub: { plan: string; status: string | null } | undefined,
  statusFilter: string
): boolean {
  if (!sub) return statusFilter === "canceled";
  return (sub.status ?? null) === statusFilter;
}

function passesFilters(
  u: User,
  sub: { plan: string; status: string | null; current_period_end: string | null } | undefined,
  opts: AdminUserListOpts
): boolean {
  if (opts.query && !matchesQuery(u, opts.query)) return false;
  if (opts.role && !matchesRole(u, opts.role)) return false;
  if (opts.suspended !== null && opts.suspended !== undefined && !matchesSuspended(u, opts.suspended)) {
    return false;
  }
  if (opts.plan && !matchesPlan(sub, opts.plan)) return false;
  if (opts.status && !matchesStatus(sub, opts.status)) return false;
  return true;
}

async function enrichRows(
  users: User[],
  subsById: Map<
    string,
    { plan: string; status: string | null; current_period_end: string | null }
  >,
  usageById: Map<string, number>
): Promise<AdminUserListRow[]> {
  return users.map((u) => {
    const sub = subsById.get(u.id);
    return {
      id: u.id,
      email: u.email,
      role: roleOf(u.app_metadata),
      created_at: u.created_at,
      suspended: isSuspendedNow(bannedUntilOf(u)),
      plan: effectivePlan(sub),
      status: sub?.status ?? null,
      current_period_end: sub?.current_period_end ?? null,
      cropsUsedToday: usageById.get(u.id) ?? 0,
    };
  });
}

async function loadSubsAndUsage(
  ids: string[],
  day: string
): Promise<{
  subsById: Map<
    string,
    { plan: string; status: string | null; current_period_end: string | null }
  >;
  usageById: Map<string, number>;
}> {
  const subsById = new Map<
    string,
    { plan: string; status: string | null; current_period_end: string | null }
  >();
  const usageById = new Map<string, number>();
  if (!ids.length) return { subsById, usageById };

  const sb = getServiceClient();
  const [{ data: subs }, { data: usage }] = await Promise.all([
    sb
      .from("subscriptions")
      .select("user_id, plan, status, current_period_end")
      .in("user_id", ids),
    sb.from("usage_days").select("user_id, crop_count").eq("day", day).in("user_id", ids),
  ]);
  for (const s of subs ?? []) {
    subsById.set(s.user_id, {
      plan: s.plan,
      status: s.status,
      current_period_end: s.current_period_end,
    });
  }
  for (const u of usage ?? []) {
    usageById.set(u.user_id, u.crop_count);
  }
  return { subsById, usageById };
}

/** Scan auth pages until the requested result page is full or auth is exhausted. */
export async function listAdminUsers(opts: AdminUserListOpts): Promise<{
  users: AdminUserListRow[];
  page: number;
  perPage: number;
  hasMore: boolean;
}> {
  const sb = getServiceClient();
  const day = new Date().toISOString().slice(0, 10);
  const targetStart = (opts.page - 1) * opts.perPage;
  const targetEnd = targetStart + opts.perPage;
  const matched: User[] = [];
  const matchedSubs = new Map<
    string,
    { plan: string; status: string | null; current_period_end: string | null }
  >();

  let scanPage = 1;
  let authHasMore = true;
  const maxScanPages = 40;

  while (matched.length < targetEnd && authHasMore && scanPage <= maxScanPages) {
    const { data, error } = await sb.auth.admin.listUsers({ page: scanPage, perPage: opts.perPage });
    if (error) throw error;
    const batch = data.users;
    authHasMore = batch.length === opts.perPage;

    const ids = batch.map((u) => u.id);
    const { subsById } = await loadSubsAndUsage(ids, day);

    for (const u of batch) {
      const sub = subsById.get(u.id);
      if (passesFilters(u, sub, opts)) {
        matched.push(u);
        if (sub) matchedSubs.set(u.id, sub);
      }
    }
    scanPage++;
  }

  const pageUsers = matched.slice(targetStart, targetEnd);
  const pageIds = pageUsers.map((u) => u.id);
  const { subsById, usageById } = await loadSubsAndUsage(pageIds, day);
  for (const [id, sub] of matchedSubs) {
    if (pageIds.includes(id)) subsById.set(id, sub);
  }

  const hasMore =
    matched.length > targetEnd || (authHasMore && scanPage <= maxScanPages);

  return {
    users: await enrichRows(pageUsers, subsById, usageById),
    page: opts.page,
    perPage: opts.perPage,
    hasMore,
  };
}
