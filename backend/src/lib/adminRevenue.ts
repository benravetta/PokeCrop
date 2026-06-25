import type Stripe from "stripe";
import { getServiceClient } from "./supabase.js";
import { getStripe, isStripeConfigured } from "./stripe.js";
import type { Plan } from "./plans.js";
import { getAdminUserIds } from "./adminAccess.js";
import { emailByUserIds } from "./adminEmails.js";

const PLAN_MRR_GBP: Record<Exclude<Plan, "free">, number> = {
  unlimited: 9.99,
  pro: 19.99,
  api: 29.99,
};

const GRADE_UNIT_GBP = 2.99;
const CACHE_MS = 60_000;

type CacheEntry<T> = { at: number; data: T };
const cache = new Map<string, CacheEntry<unknown>>();

function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key) as CacheEntry<T> | undefined;
  if (hit && Date.now() - hit.at < CACHE_MS) return Promise.resolve(hit.data);
  return fn().then((data) => {
    cache.set(key, { at: Date.now(), data });
    return data;
  });
}

function stripeDashUrl(path: string): string {
  return `https://dashboard.stripe.com${path}`;
}

function adminUserExclusion(adminIds: Set<string>): string | null {
  if (!adminIds.size) return null;
  return `(${[...adminIds].join(",")})`;
}

async function emailByCustomerIds(
  customerIds: string[]
): Promise<Map<string, { userId: string; email: string }>> {
  const map = new Map<string, { userId: string; email: string }>();
  if (!customerIds.length) return map;
  const { data: subs } = await getServiceClient()
    .from("subscriptions")
    .select("user_id, stripe_customer_id")
    .in("stripe_customer_id", customerIds);
  const userIds = (subs ?? []).map((s) => s.user_id as string);
  const emails = await emailByUserIds(userIds);
  for (const s of subs ?? []) {
    const email = emails.get(s.user_id);
    if (email && s.stripe_customer_id) {
      map.set(s.stripe_customer_id, { userId: s.user_id, email });
    }
  }
  return map;
}

export interface RevenueOverview {
  stripeConfigured: boolean;
  days: number;
  mrrEstimateGbp: number;
  activeSubscriptions: number;
  subscriptionsByPlan: Record<string, number>;
  oneOffRevenueGbp: number;
  oneOffPurchases: number;
  refundedPurchases: number;
  disputedPurchases: number;
  failedInvoices: number;
  pastDueSubscriptions: number;
  gradeCreditsOutstanding: number;
  note: string;
}

export async function getRevenueOverview(days = 30): Promise<RevenueOverview> {
  const windowDays = Math.min(Math.max(days, 1), 180);
  const since = new Date(Date.now() - windowDays * 86400_000).toISOString();
  const sb = getServiceClient();
  const adminIds = await getAdminUserIds();
  const adminExclude = adminUserExclusion(adminIds);

  let completedQ = sb
    .from("grade_purchases")
    .select("id", { count: "exact", head: true })
    .eq("status", "completed")
    .gte("credited_at", since);
  if (adminExclude) completedQ = completedQ.not("user_id", "in", adminExclude);

  let refundedQ = sb
    .from("grade_purchases")
    .select("id", { count: "exact", head: true })
    .eq("status", "refunded")
    .gte("refunded_at", since);
  if (adminExclude) refundedQ = refundedQ.not("user_id", "in", adminExclude);

  let disputedQ = sb
    .from("grade_purchases")
    .select("id", { count: "exact", head: true })
    .eq("status", "disputed")
    .gte("credited_at", since);
  if (adminExclude) disputedQ = disputedQ.not("user_id", "in", adminExclude);

  const [
    { data: subs },
    { count: completedCount },
    { count: refundedCount },
    { count: disputedCount },
    { data: creditsRow },
  ] = await Promise.all([
    sb.from("subscriptions").select("user_id, plan, status"),
    completedQ,
    refundedQ,
    disputedQ,
    sb.from("subscriptions").select("user_id, grade_credits"),
  ]);

  const subscriptionsByPlan: Record<string, number> = {};
  let mrrEstimateGbp = 0;
  let activeSubscriptions = 0;
  let pastDueSubscriptions = 0;

  for (const s of subs ?? []) {
    const userId = String(s.user_id ?? "");
    if (adminIds.has(userId)) continue;
    const plan = String(s.plan ?? "free");
    const status = String(s.status ?? "");
    if (status === "past_due") pastDueSubscriptions++;
    if (status !== "active" && status !== "trialing") continue;
    if (plan === "free") continue;
    activeSubscriptions++;
    subscriptionsByPlan[plan] = (subscriptionsByPlan[plan] ?? 0) + 1;
    if (plan in PLAN_MRR_GBP) {
      mrrEstimateGbp += PLAN_MRR_GBP[plan as Exclude<Plan, "free">];
    }
  }

  const oneOffPurchases = completedCount ?? 0;
  const oneOffRevenueGbp = oneOffPurchases * GRADE_UNIT_GBP;
  const gradeCreditsOutstanding = (creditsRow ?? [])
    .filter((r) => !adminIds.has(String(r.user_id ?? "")))
    .reduce((sum, r) => sum + (typeof r.grade_credits === "number" ? r.grade_credits : 0), 0);

  let failedInvoices = 0;
  if (isStripeConfigured()) {
    failedInvoices = await cached("rev-failed-inv", async () => {
      const stripe = getStripe();
      const [open, uncollectible] = await Promise.all([
        stripe.invoices.list({ status: "open", limit: 100 }),
        stripe.invoices.list({ status: "uncollectible", limit: 100 }),
      ]);
      return open.data.length + uncollectible.data.length;
    });
  }

  return {
    stripeConfigured: isStripeConfigured(),
    days: windowDays,
    mrrEstimateGbp: Math.round(mrrEstimateGbp * 100) / 100,
    activeSubscriptions,
    subscriptionsByPlan,
    oneOffRevenueGbp: Math.round(oneOffRevenueGbp * 100) / 100,
    oneOffPurchases,
    refundedPurchases: refundedCount ?? 0,
    disputedPurchases: disputedCount ?? 0,
    failedInvoices,
    pastDueSubscriptions,
    gradeCreditsOutstanding,
    note: "MRR and one-off totals exclude admin accounts and use plan prices, not accounting records.",
  };
}

export interface AdminPurchaseRow {
  id: number;
  userId: string;
  email: string | null;
  qty: number;
  status: string;
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
  creditedAt: string | null;
  refundedAt: string | null;
  amountGbp: number;
  stripeSessionUrl: string | null;
}

export async function listPurchases(opts: {
  page?: number;
  pageSize?: number;
  status?: string;
}): Promise<{ purchases: AdminPurchaseRow[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 25));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const adminIds = await getAdminUserIds();
  const adminExclude = adminUserExclusion(adminIds);

  let q = getServiceClient()
    .from("grade_purchases")
    .select(
      "id, user_id, qty, status, stripe_session_id, stripe_payment_intent_id, credited_at, refunded_at",
      { count: "exact" }
    )
    .order("credited_at", { ascending: false, nullsFirst: false });
  if (adminExclude) q = q.not("user_id", "in", adminExclude);

  if (opts.status) q = q.eq("status", opts.status);

  const { data, count, error } = await q.range(from, to);
  if (error) throw error;

  const emails = await emailByUserIds((data ?? []).map((r) => r.user_id as string));

  const purchases: AdminPurchaseRow[] = (data ?? []).map((r) => ({
    id: r.id as number,
    userId: r.user_id as string,
    email: emails.get(r.user_id as string) ?? null,
    qty: (r.qty as number) ?? 1,
    status: String(r.status ?? "completed"),
    stripeSessionId: (r.stripe_session_id as string | null) ?? null,
    stripePaymentIntentId: (r.stripe_payment_intent_id as string | null) ?? null,
    creditedAt: (r.credited_at as string | null) ?? null,
    refundedAt: (r.refunded_at as string | null) ?? null,
    amountGbp: ((r.qty as number) ?? 1) * GRADE_UNIT_GBP,
    stripeSessionUrl: r.stripe_session_id
      ? stripeDashUrl(`/checkout/sessions/${r.stripe_session_id}`)
      : null,
  }));

  return { purchases, total: count ?? 0, page, pageSize };
}

export interface AdminSubscriptionRow {
  userId: string;
  email: string | null;
  plan: string;
  status: string | null;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  gradeCredits: number;
  comped: boolean;
  stripeCustomerUrl: string | null;
  stripeSubscriptionUrl: string | null;
}

export async function listSubscriptions(opts: {
  page?: number;
  pageSize?: number;
  plan?: string;
  status?: string;
}): Promise<{ subscriptions: AdminSubscriptionRow[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 25));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const adminIds = await getAdminUserIds();
  const adminExclude = adminUserExclusion(adminIds);

  let q = getServiceClient()
    .from("subscriptions")
    .select(
      "user_id, plan, status, current_period_end, stripe_customer_id, stripe_subscription_id, grade_credits",
      { count: "exact" }
    )
    .order("updated_at", { ascending: false });
  if (adminExclude) q = q.not("user_id", "in", adminExclude);

  if (opts.plan) q = q.eq("plan", opts.plan);
  if (opts.status) q = q.eq("status", opts.status);

  const { data, count, error } = await q.range(from, to);
  if (error) throw error;

  const emails = await emailByUserIds((data ?? []).map((r) => r.user_id as string));

  const subscriptions: AdminSubscriptionRow[] = (data ?? []).map((r) => {
    const customerId = (r.stripe_customer_id as string | null) ?? null;
    const subId = (r.stripe_subscription_id as string | null) ?? null;
    return {
      userId: r.user_id as string,
      email: emails.get(r.user_id as string) ?? null,
      plan: String(r.plan ?? "free"),
      status: (r.status as string | null) ?? null,
      currentPeriodEnd: (r.current_period_end as string | null) ?? null,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subId,
      gradeCredits: typeof r.grade_credits === "number" ? r.grade_credits : 0,
      comped:
        !customerId &&
        String(r.plan) !== "free" &&
        (r.status === "active" || r.status === "trialing"),
      stripeCustomerUrl: customerId ? stripeDashUrl(`/customers/${customerId}`) : null,
      stripeSubscriptionUrl: subId ? stripeDashUrl(`/subscriptions/${subId}`) : null,
    };
  });

  return { subscriptions, total: count ?? 0, page, pageSize };
}

export interface AdminInvoiceRow {
  id: string;
  number: string | null;
  status: string | null;
  amountDueGbp: number;
  amountPaidGbp: number;
  currency: string;
  customerId: string | null;
  customerEmail: string | null;
  userId: string | null;
  createdAt: string;
  hostedUrl: string | null;
  pdfUrl: string | null;
}

export async function listInvoices(opts: {
  page?: number;
  pageSize?: number;
  status?: string;
}): Promise<{ invoices: AdminInvoiceRow[]; hasMore: boolean; page: number }> {
  if (!isStripeConfigured()) {
    return { invoices: [], hasMore: false, page: opts.page ?? 1 };
  }

  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(100, Math.max(1, opts.pageSize ?? 25));
  const cacheKey = `inv-${opts.status ?? "all"}-${page}-${limit}`;

  return cached(cacheKey, async () => {
    const stripe = getStripe();
    let startingAfter: string | undefined;

    for (let i = 1; i < page; i++) {
      const skip = await stripe.invoices.list({
        limit,
        ...(opts.status ? { status: opts.status as Stripe.InvoiceListParams["status"] } : {}),
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      if (!skip.has_more || skip.data.length === 0) {
        return { invoices: [], hasMore: false, page };
      }
      startingAfter = skip.data[skip.data.length - 1].id;
    }

    const list = await stripe.invoices.list({
      limit,
      ...(opts.status ? { status: opts.status as Stripe.InvoiceListParams["status"] } : {}),
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    const customerIds = list.data.map((i) => i.customer).filter(Boolean) as string[];
    const owners = await emailByCustomerIds(customerIds);

    const invoices: AdminInvoiceRow[] = list.data.map((inv) => {
      const customerId = typeof inv.customer === "string" ? inv.customer : inv.customer?.id ?? null;
      const owner = customerId ? owners.get(customerId) : undefined;
      return {
        id: inv.id,
        number: inv.number,
        status: inv.status,
        amountDueGbp: (inv.amount_due ?? 0) / 100,
        amountPaidGbp: (inv.amount_paid ?? 0) / 100,
        currency: (inv.currency ?? "gbp").toUpperCase(),
        customerId,
        customerEmail: owner?.email ?? inv.customer_email ?? null,
        userId: owner?.userId ?? null,
        createdAt: new Date((inv.created ?? 0) * 1000).toISOString(),
        hostedUrl: inv.hosted_invoice_url ?? null,
        pdfUrl: inv.invoice_pdf ?? null,
      };
    });

    return { invoices, hasMore: list.has_more, page };
  });
}

export interface AdminFailureRow {
  kind: "invoice" | "dispute" | "purchase";
  id: string;
  status: string;
  amountGbp: number | null;
  email: string | null;
  userId: string | null;
  createdAt: string;
  url: string | null;
  detail: string | null;
}

export async function listFailures(days = 30): Promise<{ failures: AdminFailureRow[] }> {
  const windowDays = Math.min(Math.max(days, 1), 180);
  const sinceUnix = Math.floor((Date.now() - windowDays * 86400_000) / 1000);
  const since = new Date(sinceUnix * 1000).toISOString();
  const failures: AdminFailureRow[] = [];

  if (isStripeConfigured()) {
    const stripe = getStripe();
    const [openInv, disputes] = await Promise.all([
      stripe.invoices.list({ status: "open", limit: 50, created: { gte: sinceUnix } }),
      stripe.disputes.list({ limit: 50, created: { gte: sinceUnix } }),
    ]);

    const customerIds = openInv.data
      .map((i) => i.customer)
      .filter(Boolean) as string[];
    const owners = await emailByCustomerIds(customerIds);

    for (const inv of openInv.data) {
      const customerId = typeof inv.customer === "string" ? inv.customer : inv.customer?.id ?? null;
      const owner = customerId ? owners.get(customerId) : undefined;
      failures.push({
        kind: "invoice",
        id: inv.id,
        status: inv.status ?? "open",
        amountGbp: (inv.amount_due ?? 0) / 100,
        email: owner?.email ?? inv.customer_email ?? null,
        userId: owner?.userId ?? null,
        createdAt: new Date((inv.created ?? 0) * 1000).toISOString(),
        url: inv.hosted_invoice_url ?? stripeDashUrl(`/invoices/${inv.id}`),
        detail: inv.collection_method ?? null,
      });
    }

    for (const d of disputes.data) {
      failures.push({
        kind: "dispute",
        id: d.id,
        status: d.status,
        amountGbp: (d.amount ?? 0) / 100,
        email: null,
        userId: null,
        createdAt: new Date(d.created * 1000).toISOString(),
        url: stripeDashUrl(`/disputes/${d.id}`),
        detail: d.reason ?? null,
      });
    }
  }

  const adminIds = await getAdminUserIds();
  const adminExclude = adminUserExclusion(adminIds);
  let disputedQ = getServiceClient()
    .from("grade_purchases")
    .select("id, user_id, qty, stripe_payment_intent_id, credited_at")
    .eq("status", "disputed")
    .gte("credited_at", since);
  if (adminExclude) disputedQ = disputedQ.not("user_id", "in", adminExclude);
  const { data: disputedPurchases } = await disputedQ;

  const emails = await emailByUserIds((disputedPurchases ?? []).map((r) => r.user_id as string));
  for (const p of disputedPurchases ?? []) {
    failures.push({
      kind: "purchase",
      id: String(p.id),
      status: "disputed",
      amountGbp: GRADE_UNIT_GBP * ((p.qty as number) ?? 1),
      email: emails.get(p.user_id as string) ?? null,
      userId: p.user_id as string,
      createdAt: (p.credited_at as string) ?? new Date().toISOString(),
      url: p.stripe_payment_intent_id
        ? stripeDashUrl(`/payments/${p.stripe_payment_intent_id}`)
        : null,
      detail: "Local grade purchase marked disputed",
    });
  }

  failures.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { failures };
}
