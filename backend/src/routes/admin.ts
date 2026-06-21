import { Router, Request, Response } from "express";
import { requireAdmin } from "../middleware/auth.js";
import { getServiceClient } from "../lib/supabase.js";
import { generateApiKey } from "../lib/apiKeys.js";
import { signedGetUrl } from "../lib/r2.js";
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
} from "../lib/keyLimit.js";

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

interface AdminUserRow {
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

// GET /admin/users — paginated list with plan + today's usage, optional email search.
router.get("/admin/users", requireAdmin, async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const perPage = Math.min(
    200,
    Math.max(1, parseInt(String(req.query.perPage ?? "50"), 10) || 50)
  );
  const query = String(req.query.query ?? "").trim().toLowerCase();

  try {
    const sb = getServiceClient();
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    let users = data.users;
    if (query) {
      users = users.filter((u) => (u.email ?? "").toLowerCase().includes(query));
    }

    const ids = users.map((u) => u.id);
    const subsById = new Map<
      string,
      { plan: string; status: string | null; current_period_end: string | null }
    >();
    const usageById = new Map<string, number>();

    if (ids.length) {
      const [{ data: subs }, { data: usage }] = await Promise.all([
        sb
          .from("subscriptions")
          .select("user_id, plan, status, current_period_end")
          .in("user_id", ids),
        sb
          .from("usage_days")
          .select("user_id, crop_count")
          .eq("day", utcDay())
          .in("user_id", ids),
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
    }

    const rows: AdminUserRow[] = users.map((u) => {
      const sub = subsById.get(u.id);
      const bannedUntil = (u as unknown as { banned_until?: string | null })
        .banned_until;
      return {
        id: u.id,
        email: u.email,
        role: roleOf(u.app_metadata),
        created_at: u.created_at,
        suspended: isSuspendedNow(bannedUntil),
        plan: sub?.plan ?? "free",
        status: sub?.status ?? null,
        current_period_end: sub?.current_period_end ?? null,
        cropsUsedToday: usageById.get(u.id) ?? 0,
      };
    });

    res.json({ users: rows, page, perPage, hasMore: data.users.length === perPage });
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
    ] = await Promise.all([
      sb.auth.admin.getUserById(id),
      sb
        .from("subscriptions")
        .select("plan, status, current_period_end, max_api_keys, stripe_customer_id")
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
        max_api_keys: override,
        key_limit: override ?? DEFAULT_MAX_ACTIVE_KEYS,
        cropsUsedToday: usage?.crop_count ?? 0,
        activeKeys: activeKeys ?? 0,
        totalKeys: totalKeys ?? 0,
        activity,
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
        const rows = await allActivity(id);
        // Sanitise the id before putting it in a response header to avoid any
        // header-injection via a crafted path param (the DB query is already
        // parameterised and safe).
        const safeId = id.replace(/[^a-zA-Z0-9-]/g, "");
        res.set({
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="activity-${safeId}.csv"`,
        });
        res.send(activityToCsv(rows));
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

// POST /admin/users/:id/role — promote/demote (stored in app_metadata).
router.post("/admin/users/:id/role", requireAdmin, async (req: Request, res: Response) => {
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
    res.json({ ok: true });
  } catch (err) {
    console.error("admin set role failed:", err);
    res.status(500).json({ error: "Failed to update role." });
  }
});

// POST /admin/users/:id/plan — manual plan override (comped accounts etc.). An
// optional status lets an admin set the subscription state explicitly.
router.post("/admin/users/:id/plan", requireAdmin, async (req: Request, res: Response) => {
  const plan = req.body?.plan;
  if (plan !== "free" && plan !== "unlimited" && plan !== "api") {
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
  requireAdmin,
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
      res.json({ ok: true });
    } catch (err) {
      console.error("admin set key limit failed:", err);
      res.status(500).json({ error: "Failed to update key limit." });
    }
  }
);

// POST /admin/users/:id/suspend — ban/unban the account.
router.post("/admin/users/:id/suspend", requireAdmin, async (req: Request, res: Response) => {
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
router.post("/admin/users/:id/api-keys", requireAdmin, async (req: Request, res: Response) => {
  const label = typeof req.body?.label === "string" ? req.body.label.slice(0, 80) : null;
  try {
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
    res.json({ key: data, secret: fullKey });
  } catch (err) {
    console.error("admin issue api key failed:", err);
    res.status(500).json({ error: "Failed to issue API key." });
  }
});

router.delete("/admin/api-keys/:keyId", requireAdmin, async (req: Request, res: Response) => {
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

// GET /admin/catalog/items?tcg=&set=&number=&limit=&offset= — paginated items.
router.get("/admin/catalog/items", requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "60"), 10) || 60, 1), 200);
    const offset = Math.max(parseInt(String(req.query.offset ?? "0"), 10) || 0, 0);
    let q = getServiceClient()
      .from("catalog_items")
      .select(
        "id, r2_key, tcg, card_set, number, name, confidence, source, width, height, created_at",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (typeof req.query.tcg === "string" && req.query.tcg) q = q.eq("tcg", req.query.tcg);
    if (typeof req.query.set === "string" && req.query.set) q = q.eq("card_set", req.query.set);
    if (typeof req.query.number === "string" && req.query.number)
      q = q.eq("number", req.query.number);

    const { data, error, count } = await q;
    if (error) throw error;

    // Attach short-lived presigned URLs so the browser can load thumbnails
    // directly from the private R2 bucket without proxying bytes through Fly.
    const items = await Promise.all(
      (data ?? []).map(async (row) => ({
        ...row,
        url: await signedGetUrl(row.r2_key, 900).catch(() => null),
      }))
    );
    res.json({ items, total: count ?? 0, limit, offset });
  } catch (err) {
    console.error("admin catalog items failed:", err);
    res.status(500).json({ error: "Failed to load catalog items." });
  }
});

export { router as adminRoutes };
