import { Router, Request, Response } from "express";
import { requireAdmin, requireAdminMutating } from "../middleware/auth.js";
import { getServiceClient } from "../lib/supabase.js";
import { generateApiKey } from "../lib/apiKeys.js";
import { listAdminCatalogItems } from "../lib/adminCatalog.js";
import {
  logActivity,
  recentActivity,
  allActivity,
  activityToCsv,
  DEFAULT_RECENT,
} from "../lib/activity.js";
import {
  DEFAULT_MAX_ACTIVE_KEYS,
  MAX_KEY_LIMIT,
  getKeyLimitOverride,
  effectiveKeyLimit,
} from "../lib/keyLimit.js";
import { logAdminAudit } from "../lib/adminAudit.js";
import {
  getRevenueOverview,
  listPurchases,
  listSubscriptions,
  listInvoices,
  listFailures,
} from "../lib/adminRevenue.js";
import { listUsageEvents, exportUsageEventsCsv, listUserUsageEvents } from "../lib/adminUsage.js";
import { listFormSubmissions, listStripeEvents, listUserPurchases } from "../lib/adminOps.js";
import { listAdminUsers } from "../lib/adminUsers.js";
import { createInvite, listInvites, resendInvite, normalizeInviteEmail } from "../lib/invites.js";
import { isInviteRequired, setInviteRequiredPolicy } from "../lib/appSettings.js";
import {
  claimInviteRequestApproval,
  linkInviteToRequest,
  listInviteRequests,
  markInviteRequestReviewed,
  revertInviteRequestApproval,
} from "../lib/inviteRequests.js";
import { isSmtpConfigured, sendMail } from "../lib/mail.js";
import { buildInviteEmailHtml } from "../lib/inviteEmail.js";
import {
  parsePlan,
  parseSubStatus,
  parsePurchaseStatus,
  parseUsageKind,
  parseUsageBilling,
  parseUsageSource,
  parseInvoiceStatus,
  parseIsoDate,
  parseDays,
  parseUuid,
  parseFormKind,
} from "../lib/adminFilters.js";

const router = Router();

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

function roleOf(appMetadata: unknown): "user" | "admin" {
  return (appMetadata as Record<string, unknown> | undefined)?.role === "admin"
    ? "admin"
    : "user";
}

function isSuspendedNow(bannedUntil: string | null | undefined): boolean {
  return Boolean(bannedUntil && new Date(bannedUntil) > new Date());
}

// GET /admin/stats — dashboard aggregates in a single round-trip.
router.get("/admin/stats", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const { data, error } = await getServiceClient().rpc("admin_overview");
    if (error) throw error;
    res.json({ stats: data });
  } catch (err) {
    console.error("admin stats failed:", err);
    res.status(500).json({ error: "Failed to load stats." });
  }
});

function audit(req: Request, action: Parameters<typeof logAdminAudit>[0]["action"], targetUserId?: string, detail?: Record<string, unknown>) {
  logAdminAudit({
    actorId: req.user!.id,
    actorEmail: req.user!.email ?? null,
    action,
    targetUserId,
    detail,
  });
}

function invalid(res: Response, message: string): void {
  res.status(400).json({ error: message });
}

// GET /admin/users — paginated list with plan + today's usage, optional email search.
router.get("/admin/users", requireAdmin, async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const perPage = Math.min(
    200,
    Math.max(1, parseInt(String(req.query.perPage ?? "50"), 10) || 50)
  );
  const query = String(req.query.query ?? "").trim().toLowerCase() || undefined;

  const planRaw = typeof req.query.plan === "string" ? req.query.plan : null;
  const statusRaw = typeof req.query.status === "string" ? req.query.status : null;
  if (planRaw && !parsePlan(planRaw)) {
    invalid(res, "Invalid plan filter.");
    return;
  }
  if (statusRaw && !parseSubStatus(statusRaw)) {
    invalid(res, "Invalid status filter.");
    return;
  }

  const suspendedFilter =
    req.query.suspended === "true" ? true : req.query.suspended === "false" ? false : null;
  const roleFilter =
    req.query.role === "admin" ? "admin" : req.query.role === "user" ? "user" : null;
  if (req.query.role && !roleFilter) {
    invalid(res, "Invalid role filter.");
    return;
  }

  try {
    const result = await listAdminUsers({
      page,
      perPage,
      query,
      plan: planRaw ? parsePlan(planRaw) : null,
      status: statusRaw ? parseSubStatus(statusRaw) : null,
      suspended: suspendedFilter,
      role: roleFilter,
    });
    res.json({
      users: result.users,
      page: result.page,
      perPage: result.perPage,
      hasMore: result.hasMore,
    });
  } catch (err) {
    console.error("admin list users failed:", err);
    res.status(500).json({ error: "Failed to load users." });
  }
});

// GET /admin/users/:id — full detail for the user drawer.
router.get("/admin/users/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = req.params.id;
  try {
    const sb = getServiceClient();
    const [
      { data: authData, error: authErr },
      { data: sub },
      { data: usage },
      { count: activeKeys },
      { count: totalKeys },
      activity,
      override,
      recentPurchases,
      recentUsage,
    ] = await Promise.all([
      sb.auth.admin.getUserById(id),
      sb
        .from("subscriptions")
        .select(
          "plan, status, current_period_end, max_api_keys, stripe_customer_id, grade_credits"
        )
        .eq("user_id", id)
        .maybeSingle(),
      sb
        .from("usage_days")
        .select("crop_count")
        .eq("user_id", id)
        .eq("day", utcDay())
        .maybeSingle(),
      sb
        .from("api_keys")
        .select("id", { count: "exact", head: true })
        .eq("user_id", id)
        .is("revoked_at", null),
      sb.from("api_keys").select("id", { count: "exact", head: true }).eq("user_id", id),
      recentActivity(id, DEFAULT_RECENT),
      getKeyLimitOverride(id),
      listUserPurchases(id, 10),
      listUserUsageEvents(id, 20),
    ]);

    if (authErr || !authData?.user) {
      res.status(404).json({ error: "User not found." });
      return;
    }
    const u = authData.user;
    const bannedUntil = (u as unknown as { banned_until?: string | null }).banned_until;

    res.json({
      user: {
        id: u.id,
        email: u.email,
        role: roleOf(u.app_metadata),
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        email_confirmed_at: (u as unknown as { email_confirmed_at?: string | null })
          .email_confirmed_at ?? null,
        suspended: isSuspendedNow(bannedUntil),
        plan: sub?.plan ?? "free",
        status: sub?.status ?? null,
        current_period_end: sub?.current_period_end ?? null,
        has_stripe: Boolean(sub?.stripe_customer_id),
        stripe_customer_id: sub?.stripe_customer_id ?? null,
        stripe_customer_url: sub?.stripe_customer_id
          ? `https://dashboard.stripe.com/customers/${sub.stripe_customer_id}`
          : null,
        grade_credits: typeof sub?.grade_credits === "number" ? sub.grade_credits : 0,
        max_api_keys: override,
        key_limit: override ?? DEFAULT_MAX_ACTIVE_KEYS,
        cropsUsedToday: usage?.crop_count ?? 0,
        activeKeys: activeKeys ?? 0,
        totalKeys: totalKeys ?? 0,
        activity,
        recentPurchases,
        recentUsage,
      },
    });
  } catch (err) {
    console.error("admin user detail failed:", err);
    res.status(500).json({ error: "Failed to load user." });
  }
});

// GET /admin/users/:id/activity — recent feed, or ?download=csv for the full log.
router.get(
  "/admin/users/:id/activity",
  requireAdmin,
  async (req: Request, res: Response) => {
    const id = req.params.id;
    try {
      if (String(req.query.download) === "csv") {
        res.status(400).json({ error: "Use GET /api/admin/users/:id/activity/export for CSV download." });
        return;
      }
      const limit = parseInt(String(req.query.limit ?? DEFAULT_RECENT), 10) || DEFAULT_RECENT;
      const activity = await recentActivity(id, limit);
      res.json({ activity });
    } catch (err) {
      console.error("admin activity failed:", err);
      res.status(500).json({ error: "Failed to load activity." });
    }
  }
);

router.get(
  "/admin/users/:id/activity/export",
  requireAdminMutating,
  async (req: Request, res: Response) => {
    const id = req.params.id;
    try {
      const rows = await allActivity(id);
      const safeId = id.replace(/[^a-zA-Z0-9-]/g, "");
      audit(req, "activity.exported", id, { rows: rows.length });
      res.set({
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="activity-${safeId}.csv"`,
      });
      res.send(activityToCsv(rows));
    } catch (err) {
      console.error("admin activity export failed:", err);
      res.status(500).json({ error: "Failed to export activity." });
    }
  }
);

// POST /admin/users/:id/role — promote/demote (stored in app_metadata).
router.post("/admin/users/:id/role", requireAdminMutating, async (req: Request, res: Response) => {
  const role = req.body?.role;
  if (role !== "user" && role !== "admin") {
    res.status(400).json({ error: "Invalid role." });
    return;
  }
  if (req.params.id === req.user!.id && role !== "admin") {
    res.status(400).json({ error: "You can't remove your own admin access." });
    return;
  }
  try {
    const sb = getServiceClient();
    const { data: existing } = await sb.auth.admin.getUserById(req.params.id);
    const meta = { ...(existing.user?.app_metadata ?? {}), role };
    const { error } = await sb.auth.admin.updateUserById(req.params.id, {
      app_metadata: meta,
    });
    if (error) throw error;
    logActivity({
      userId: req.params.id,
      action: "role.changed",
      actorId: req.user!.id,
      actorEmail: req.user!.email ?? null,
      detail: { role, target_email: existing.user?.email ?? null },
    });
    audit(req, "role.changed", req.params.id, { role });
    res.json({ ok: true });
  } catch (err) {
    console.error("admin set role failed:", err);
    res.status(500).json({ error: "Failed to update role." });
  }
});

// POST /admin/users/:id/plan — manual plan override (comped accounts etc.). An
// optional status lets an admin set the subscription state explicitly.
router.post("/admin/users/:id/plan", requireAdminMutating, async (req: Request, res: Response) => {
  const plan = req.body?.plan;
  if (plan !== "free" && plan !== "unlimited" && plan !== "pro" && plan !== "api") {
    res.status(400).json({ error: "Invalid plan." });
    return;
  }
  const allowedStatus = ["active", "trialing", "canceled"];
  let status: string = plan === "free" ? "canceled" : "active";
  if (typeof req.body?.status === "string") {
    if (!allowedStatus.includes(req.body.status)) {
      res.status(400).json({ error: "Invalid status." });
      return;
    }
    status = req.body.status;
  }
  try {
    const sb = getServiceClient();
    const { error } = await sb.from("subscriptions").upsert(
      {
        user_id: req.params.id,
        plan,
        status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    if (error) throw error;
    logActivity({
      userId: req.params.id,
      action: "plan.changed",
      actorId: req.user!.id,
      actorEmail: req.user!.email ?? null,
      detail: { plan, status, source: "admin" },
    });
    audit(req, "plan.changed", req.params.id, { plan, status });
    res.json({ ok: true });
  } catch (err) {
    console.error("admin set plan failed:", err);
    res.status(500).json({ error: "Failed to update plan." });
  }
});

// POST /admin/users/:id/key-limit — set the per-user active-key cap (null resets
// to the global default).
router.post(
  "/admin/users/:id/key-limit",
  requireAdminMutating,
  async (req: Request, res: Response) => {
    const raw = req.body?.limit;
    let limit: number | null;
    if (raw === null || raw === undefined || raw === "") {
      limit = null;
    } else {
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 0 || n > MAX_KEY_LIMIT) {
        res.status(400).json({ error: `Limit must be 0–${MAX_KEY_LIMIT}, or empty to reset.` });
        return;
      }
      limit = n;
    }
    try {
      const sb = getServiceClient();
      const { error } = await sb.from("subscriptions").upsert(
        {
          user_id: req.params.id,
          max_api_keys: limit,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      if (error) throw error;
      logActivity({
        userId: req.params.id,
        action: "key_limit.changed",
        actorId: req.user!.id,
        actorEmail: req.user!.email ?? null,
        detail: { max_api_keys: limit },
      });
      audit(req, "key_limit.changed", req.params.id, { max_api_keys: limit });
      res.json({ ok: true });
    } catch (err) {
      console.error("admin set key limit failed:", err);
      res.status(500).json({ error: "Failed to update key limit." });
    }
  }
);

// POST /admin/users/:id/suspend — ban/unban the account.
router.post("/admin/users/:id/suspend", requireAdminMutating, async (req: Request, res: Response) => {
  const suspended = Boolean(req.body?.suspended);
  if (req.params.id === req.user!.id) {
    res.status(400).json({ error: "You can't suspend your own account." });
    return;
  }
  try {
    const sb = getServiceClient();
    const { error } = await sb.auth.admin.updateUserById(req.params.id, {
      ban_duration: suspended ? "876000h" : "none",
    });
    if (error) throw error;
    // Revoke the user's API keys on suspend so access stops immediately, even
    // within the lifetime of an already-issued JWT. Keys are not auto-restored.
    if (suspended) {
      const { error: revokeErr } = await sb
        .from("api_keys")
        .update({ revoked_at: new Date().toISOString() })
        .eq("user_id", req.params.id)
        .is("revoked_at", null);
      if (revokeErr) throw revokeErr;
    }
    logActivity({
      userId: req.params.id,
      action: suspended ? "account.suspended" : "account.reinstated",
      actorId: req.user!.id,
      actorEmail: req.user!.email ?? null,
    });
    audit(req, suspended ? "account.suspended" : "account.reinstated", req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error("admin suspend failed:", err);
    res.status(500).json({ error: "Failed to update account." });
  }
});

// ---- API keys ----

router.get("/admin/users/:id/api-keys", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { data, error } = await getServiceClient()
      .from("api_keys")
      .select("id, label, key_prefix, created_at, last_used_at, revoked_at")
      .eq("user_id", req.params.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ keys: data ?? [] });
  } catch (err) {
    console.error("admin list api keys failed:", err);
    res.status(500).json({ error: "Failed to load API keys." });
  }
});

// Issue a new API key. The full key is shown ONCE; only its hash + prefix persist.
router.post("/admin/users/:id/api-keys", requireAdminMutating, async (req: Request, res: Response) => {
  const label = typeof req.body?.label === "string" ? req.body.label.slice(0, 80) : null;
  const force = req.body?.force === true;
  try {
    const sb = getServiceClient();
    if (!force) {
      const [{ count, error: countErr }, limit] = await Promise.all([
        sb
          .from("api_keys")
          .select("id", { count: "exact", head: true })
          .eq("user_id", req.params.id)
          .is("revoked_at", null),
        effectiveKeyLimit(req.params.id),
      ]);
      if (countErr) throw countErr;
      if ((count ?? 0) >= limit) {
        res.status(409).json({
          error: `User already has ${limit} active API keys. Pass force: true to override.`,
        });
        return;
      }
    }

    const { fullKey, keyPrefix, keyHash } = generateApiKey();

    const { data, error } = await getServiceClient()
      .from("api_keys")
      .insert({
        user_id: req.params.id,
        label,
        key_prefix: keyPrefix,
        key_hash: keyHash,
      })
      .select("id, label, key_prefix, created_at")
      .single();
    if (error) throw error;

    logActivity({
      userId: req.params.id,
      action: "key.created",
      actorId: req.user!.id,
      actorEmail: req.user!.email ?? null,
      detail: { key_id: data.id, label, key_prefix: keyPrefix, source: "admin" },
    });
    audit(req, "key.created", req.params.id, { key_id: data.id, label, key_prefix: keyPrefix, force });
    res.json({ key: data, secret: fullKey });
  } catch (err) {
    console.error("admin issue api key failed:", err);
    res.status(500).json({ error: "Failed to issue API key." });
  }
});

router.delete("/admin/api-keys/:keyId", requireAdminMutating, async (req: Request, res: Response) => {
  try {
    // Fetch the owning user so the revocation lands on the right timeline.
    const { data, error } = await getServiceClient()
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", req.params.keyId)
      .is("revoked_at", null)
      .select("id, user_id, key_prefix")
      .maybeSingle();
    if (error) throw error;
    if (data) {
      logActivity({
        userId: data.user_id,
        action: "key.revoked",
        actorId: req.user!.id,
        actorEmail: req.user!.email ?? null,
        detail: { key_id: data.id, key_prefix: data.key_prefix, source: "admin" },
      });
      audit(req, "key.revoked", data.user_id, {
        key_id: data.id,
        key_prefix: data.key_prefix,
      });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("admin revoke api key failed:", err);
    res.status(500).json({ error: "Failed to revoke API key." });
  }
});

// ----------------------------------------------------------------------------
// Catalog browser (R2-backed archive of crops, organised by TCG/set/number).
// ----------------------------------------------------------------------------

// GET /admin/ai-spend?days=30 — token-exact OpenAI spend, by feature and day.
router.get("/admin/ai-spend", requireAdmin, async (req: Request, res: Response) => {
  try {
    const days = parseDays(req.query.days, 30);
    const { data, error } = await getServiceClient().rpc("ai_spend_summary", {
      p_days: days,
    });
    if (error) throw error;
    res.json({ spend: data, days });
  } catch (err) {
    console.error("admin ai-spend failed:", err);
    res.status(500).json({ error: "Failed to load AI spend." });
  }
});

// GET /admin/catalog/facets?tcg=&set= — grouped counts for tree navigation.
router.get("/admin/catalog/facets", requireAdmin, async (req: Request, res: Response) => {
  try {
    const tcg = typeof req.query.tcg === "string" && req.query.tcg ? req.query.tcg : null;
    const set = typeof req.query.set === "string" && req.query.set ? req.query.set : null;
    const { data, error } = await getServiceClient().rpc("catalog_facets", {
      p_tcg: tcg,
      p_set: set,
    });
    if (error) throw error;
    res.json({ facets: data ?? [] });
  } catch (err) {
    console.error("admin catalog facets failed:", err);
    res.status(500).json({ error: "Failed to load catalog facets." });
  }
});

// GET /admin/catalog/items?q=&page=&pageSize=&tcg=&set=&number= — searchable catalog.
router.get("/admin/catalog/items", requireAdmin, async (req: Request, res: Response) => {
  try {
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
    const result = await listAdminCatalogItems({
      q: str(req.query.q),
      tcg: str(req.query.tcg),
      set: str(req.query.set),
      number: str(req.query.number),
      page: req.query.page ? parseInt(String(req.query.page), 10) : undefined,
      pageSize: req.query.pageSize ? parseInt(String(req.query.pageSize), 10) : undefined,
    });
    res.json(result);
  } catch (err) {
    console.error("admin catalog items failed:", err);
    res.status(500).json({ error: "Failed to load catalog items." });
  }
});

// ---- Revenue (Stripe + grade_purchases) ----

router.get("/admin/revenue/overview", requireAdmin, async (req: Request, res: Response) => {
  try {
    const days = parseDays(req.query.days, 30);
    const overview = await getRevenueOverview(days);
    res.json({ overview });
  } catch (err) {
    console.error("admin revenue overview failed:", err);
    res.status(500).json({ error: "Failed to load revenue overview." });
  }
});

router.get("/admin/revenue/purchases", requireAdmin, async (req: Request, res: Response) => {
  try {
    const page = parseInt(String(req.query.page ?? "1"), 10) || 1;
    const statusRaw = typeof req.query.status === "string" ? req.query.status : undefined;
    const status = statusRaw ? parsePurchaseStatus(statusRaw) : undefined;
    if (statusRaw && !status) {
      invalid(res, "Invalid purchase status.");
      return;
    }
    const result = await listPurchases({ page, status: status ?? undefined });
    res.json(result);
  } catch (err) {
    console.error("admin revenue purchases failed:", err);
    res.status(500).json({ error: "Failed to load purchases." });
  }
});

router.get("/admin/revenue/subscriptions", requireAdmin, async (req: Request, res: Response) => {
  try {
    const page = parseInt(String(req.query.page ?? "1"), 10) || 1;
    const planRaw = typeof req.query.plan === "string" ? req.query.plan : undefined;
    const statusRaw = typeof req.query.status === "string" ? req.query.status : undefined;
    const plan = planRaw ? parsePlan(planRaw) : undefined;
    const status = statusRaw ? parseSubStatus(statusRaw) : undefined;
    if (planRaw && !plan) {
      invalid(res, "Invalid plan filter.");
      return;
    }
    if (statusRaw && !status) {
      invalid(res, "Invalid status filter.");
      return;
    }
    const result = await listSubscriptions({ page, plan: plan ?? undefined, status: status ?? undefined });
    res.json(result);
  } catch (err) {
    console.error("admin revenue subscriptions failed:", err);
    res.status(500).json({ error: "Failed to load subscriptions." });
  }
});

router.get("/admin/revenue/invoices", requireAdmin, async (req: Request, res: Response) => {
  try {
    const page = parseInt(String(req.query.page ?? "1"), 10) || 1;
    const statusRaw = typeof req.query.status === "string" ? req.query.status : undefined;
    const status = statusRaw ? parseInvoiceStatus(statusRaw) : undefined;
    if (statusRaw && !status) {
      invalid(res, "Invalid invoice status.");
      return;
    }
    const result = await listInvoices({ page, status });
    res.json(result);
  } catch (err) {
    console.error("admin revenue invoices failed:", err);
    res.status(500).json({ error: "Failed to load invoices." });
  }
});

router.get("/admin/revenue/failures", requireAdmin, async (req: Request, res: Response) => {
  try {
    const days = parseDays(req.query.days, 30);
    const result = await listFailures(days);
    res.json(result);
  } catch (err) {
    console.error("admin revenue failures failed:", err);
    res.status(500).json({ error: "Failed to load payment failures." });
  }
});

// ---- Usage explorer ----

router.get("/admin/usage/events", requireAdmin, async (req: Request, res: Response) => {
  try {
    const page = parseInt(String(req.query.page ?? "1"), 10) || 1;
    const kindRaw = typeof req.query.kind === "string" ? req.query.kind : undefined;
    const billingRaw = typeof req.query.billing === "string" ? req.query.billing : undefined;
    const sourceRaw = typeof req.query.source === "string" ? req.query.source : undefined;
    const fromRaw = typeof req.query.from === "string" ? req.query.from : undefined;
    const toRaw = typeof req.query.to === "string" ? req.query.to : undefined;

    if (kindRaw && !parseUsageKind(kindRaw)) {
      invalid(res, "Invalid kind filter.");
      return;
    }
    if (billingRaw && !parseUsageBilling(billingRaw)) {
      invalid(res, "Invalid billing filter.");
      return;
    }
    if (sourceRaw && !parseUsageSource(sourceRaw)) {
      invalid(res, "Invalid source filter.");
      return;
    }
    const from = fromRaw ? parseIsoDate(fromRaw) : undefined;
    const to = toRaw ? parseIsoDate(toRaw) : undefined;
    if (fromRaw && !from) {
      invalid(res, "Invalid from date.");
      return;
    }
    if (toRaw && !to) {
      invalid(res, "Invalid to date.");
      return;
    }

    const userIdRaw = typeof req.query.userId === "string" ? req.query.userId : undefined;
    const userId = userIdRaw ? parseUuid(userIdRaw) : undefined;
    if (userIdRaw && !userId) {
      invalid(res, "Invalid userId filter.");
      return;
    }

    const result = await listUsageEvents({
      page,
      kind: kindRaw ? parseUsageKind(kindRaw) : undefined,
      billing: billingRaw ? parseUsageBilling(billingRaw) : undefined,
      source: sourceRaw ? parseUsageSource(sourceRaw) : undefined,
      from,
      to,
      userId,
    });
    res.json(result);
  } catch (err) {
    console.error("admin usage events failed:", err);
    res.status(500).json({ error: "Failed to load usage events." });
  }
});

router.get("/admin/usage/events.csv", requireAdminMutating, async (req: Request, res: Response) => {
  try {
    const kindRaw = typeof req.query.kind === "string" ? req.query.kind : undefined;
    const billingRaw = typeof req.query.billing === "string" ? req.query.billing : undefined;
    const sourceRaw = typeof req.query.source === "string" ? req.query.source : undefined;
    const fromRaw = typeof req.query.from === "string" ? req.query.from : undefined;
    const toRaw = typeof req.query.to === "string" ? req.query.to : undefined;

    if (kindRaw && !parseUsageKind(kindRaw)) {
      invalid(res, "Invalid kind filter.");
      return;
    }
    if (billingRaw && !parseUsageBilling(billingRaw)) {
      invalid(res, "Invalid billing filter.");
      return;
    }
    if (sourceRaw && !parseUsageSource(sourceRaw)) {
      invalid(res, "Invalid source filter.");
      return;
    }
    const from = fromRaw ? parseIsoDate(fromRaw) : undefined;
    const to = toRaw ? parseIsoDate(toRaw) : undefined;
    if (fromRaw && !from) {
      invalid(res, "Invalid from date.");
      return;
    }
    if (toRaw && !to) {
      invalid(res, "Invalid to date.");
      return;
    }

    const csv = await exportUsageEventsCsv({
      kind: kindRaw ? parseUsageKind(kindRaw) : undefined,
      billing: billingRaw ? parseUsageBilling(billingRaw) : undefined,
      source: sourceRaw ? parseUsageSource(sourceRaw) : undefined,
      from,
      to,
    });
    audit(req, "usage.exported", undefined, {
      kind: kindRaw ?? null,
      billing: billingRaw ?? null,
      source: sourceRaw ?? null,
      from: from ?? null,
      to: to ?? null,
    });
    res.set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="usage-events.csv"',
    });
    res.send(csv);
  } catch (err) {
    console.error("admin usage export failed:", err);
    res.status(500).json({ error: "Failed to export usage events." });
  }
});

// ---- Operations (forms, webhooks) ----

router.get("/admin/forms/submissions", requireAdmin, async (req: Request, res: Response) => {
  try {
    const page = parseInt(String(req.query.page ?? "1"), 10) || 1;
    const kindRaw = typeof req.query.kind === "string" ? req.query.kind : undefined;
    const kind = kindRaw ? parseFormKind(kindRaw) : undefined;
    if (kindRaw && !kind) {
      invalid(res, "Invalid form kind.");
      return;
    }
    const result = await listFormSubmissions({ page, kind });
    res.json(result);
  } catch (err) {
    console.error("admin form submissions failed:", err);
    res.status(500).json({ error: "Failed to load form submissions." });
  }
});

router.get("/admin/stripe/events", requireAdmin, async (req: Request, res: Response) => {
  try {
    const page = parseInt(String(req.query.page ?? "1"), 10) || 1;
    const result = await listStripeEvents({ page });
    res.json(result);
  } catch (err) {
    console.error("admin stripe events failed:", err);
    res.status(500).json({ error: "Failed to load Stripe events." });
  }
});

function inviteRegisterUrl(token: string): string {
  const origin = (process.env.PUBLIC_ORIGIN || "http://localhost:8080").replace(/\/$/, "");
  return `${origin}/register?invite=${encodeURIComponent(token)}`;
}

async function mailInvite(opts: {
  email: string;
  role: "user" | "admin";
  token: string;
}): Promise<void> {
  const registerUrl = inviteRegisterUrl(opts.token);
  await sendMail({
    to: opts.email,
    subject: "You're invited to GemCheck",
    html: buildInviteEmailHtml({ registerUrl, role: opts.role }),
  });
}

router.get("/admin/beta/settings", requireAdmin, async (_req: Request, res: Response) => {
  try {
    res.json({ inviteRequired: await isInviteRequired() });
  } catch (err) {
    console.error("admin beta settings read failed:", err);
    res.status(500).json({ error: "Failed to load beta settings." });
  }
});

router.patch("/admin/beta/settings", requireAdminMutating, async (req: Request, res: Response) => {
  if (typeof req.body?.inviteRequired !== "boolean") {
    res.status(400).json({ error: "inviteRequired (boolean) is required." });
    return;
  }
  try {
    const { inviteRequired, supabaseSignupSynced } = await setInviteRequiredPolicy(
      req.body.inviteRequired
    );
    audit(req, "beta.invite_required.changed", undefined, {
      inviteRequired,
      supabaseSignupSynced,
    });
    res.json({ inviteRequired, supabaseSignupSynced });
  } catch (err) {
    console.error("admin beta settings update failed:", err);
    const message =
      err instanceof Error ? err.message : "Failed to update beta settings.";
    res.status(500).json({ error: message });
  }
});

router.get("/admin/invite-requests", requireAdmin, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? "25"), 10) || 25));
    const statusRaw = String(req.query.status ?? "pending");
    const status =
      statusRaw === "approved" || statusRaw === "rejected" || statusRaw === "all"
        ? statusRaw
        : "pending";
    const result = await listInviteRequests({ page, pageSize, status });
    res.json(result);
  } catch (err) {
    console.error("admin list invite requests failed:", err);
    res.status(500).json({ error: "Failed to load access requests." });
  }
});

router.post(
  "/admin/invite-requests/:id/approve",
  requireAdminMutating,
  async (req: Request, res: Response) => {
    const requestId = parseUuid(req.params.id);
    if (!requestId) {
      res.status(400).json({ error: "Invalid request id." });
      return;
    }
    if (!isSmtpConfigured()) {
      res.status(503).json({ error: "SMTP is not configured. Set SMTP_* secrets on the server." });
      return;
    }
    let claimed: Awaited<ReturnType<typeof claimInviteRequestApproval>> = null;
    try {
      claimed = await claimInviteRequestApproval(requestId, req.user!.id);
      if (!claimed) {
        res.status(404).json({ error: "Pending access request not found." });
        return;
      }
      const role = "user" as const;
      const { token, inviteId } = await createInvite({
        email: claimed.email,
        role,
        invitedBy: req.user!.id,
      });
      await mailInvite({ email: claimed.email, role, token });
      await linkInviteToRequest(requestId, inviteId);
      audit(req, "invite_request.approved", undefined, {
        requestId,
        email: claimed.email,
        role,
        inviteId,
      });
      res.json({ ok: true, inviteId });
    } catch (err) {
      if (claimed) {
        await revertInviteRequestApproval(requestId).catch((revertErr) =>
          console.error("revert invite request approval failed:", revertErr)
        );
      }
      console.error("admin approve invite request failed:", err);
      res.status(500).json({ error: "Failed to approve access request." });
    }
  }
);

router.post(
  "/admin/invite-requests/:id/reject",
  requireAdminMutating,
  async (req: Request, res: Response) => {
    const requestId = parseUuid(req.params.id);
    if (!requestId) {
      res.status(400).json({ error: "Invalid request id." });
      return;
    }
    try {
      const updated = await markInviteRequestReviewed(
        requestId,
        "rejected",
        req.user!.id
      );
      if (!updated) {
        res.status(404).json({ error: "Pending access request not found." });
        return;
      }
      audit(req, "invite_request.rejected", undefined, {
        requestId,
        email: updated.email,
      });
      res.json({ ok: true });
    } catch (err) {
      console.error("admin reject invite request failed:", err);
      res.status(500).json({ error: "Failed to reject access request." });
    }
  }
);

router.get("/admin/invites", requireAdmin, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? "25"), 10) || 25));
    const result = await listInvites({ page, pageSize });
    res.json(result);
  } catch (err) {
    console.error("admin list invites failed:", err);
    res.status(500).json({ error: "Failed to load invites." });
  }
});

router.post("/admin/invites", requireAdminMutating, async (req: Request, res: Response) => {
  const emailRaw = String(req.body?.email ?? "").trim();
  const email = normalizeInviteEmail(emailRaw);
  const role = req.body?.role === "admin" ? "admin" : "user";
  if (!email) {
    res.status(400).json({ error: "Valid email required." });
    return;
  }
  if (!isSmtpConfigured()) {
    res.status(503).json({ error: "SMTP is not configured. Set SMTP_* secrets on the server." });
    return;
  }
  try {
    const { token, inviteId } = await createInvite({
      email,
      role,
      invitedBy: req.user!.id,
    });
    await mailInvite({ email, role, token });
    audit(req, "invite.sent", undefined, { email, role, inviteId });
    res.status(201).json({ ok: true, inviteId });
  } catch (err) {
    console.error("admin send invite failed:", err);
    res.status(500).json({ error: "Failed to send invitation." });
  }
});

router.post("/admin/invites/:id/resend", requireAdminMutating, async (req: Request, res: Response) => {
  if (!isSmtpConfigured()) {
    res.status(503).json({ error: "SMTP is not configured. Set SMTP_* secrets on the server." });
    return;
  }
  try {
    const { token, email, role } = await resendInvite(req.params.id);
    await mailInvite({ email, role, token });
    audit(req, "invite.resent", undefined, { email, role, inviteId: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    console.error("admin resend invite failed:", err);
    const msg = err instanceof Error ? err.message : "Failed to resend invitation.";
    res.status(err instanceof Error && msg.includes("not found") ? 404 : 500).json({ error: msg });
  }
});

export { router as adminRoutes };
