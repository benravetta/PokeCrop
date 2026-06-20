import { Router, Request, Response } from "express";
import crypto from "crypto";
import { requireAdmin } from "../middleware/auth.js";
import { getServiceClient } from "../lib/supabase.js";

const router = Router();

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
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
    const subsById = new Map<string, { plan: string; status: string | null; current_period_end: string | null }>();
    const usageById = new Map<string, number>();

    if (ids.length) {
      const [{ data: subs }, { data: usage }] = await Promise.all([
        sb.from("subscriptions").select("user_id, plan, status, current_period_end").in("user_id", ids),
        sb.from("usage_days").select("user_id, crop_count").eq("day", utcDay()).in("user_id", ids),
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
      const role =
        (u.app_metadata as Record<string, unknown> | undefined)?.role === "admin"
          ? "admin"
          : "user";
      const bannedUntil = (u as unknown as { banned_until?: string | null }).banned_until;
      return {
        id: u.id,
        email: u.email,
        role,
        created_at: u.created_at,
        suspended: Boolean(bannedUntil && new Date(bannedUntil) > new Date()),
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
    res.json({ ok: true });
  } catch (err) {
    console.error("admin set role failed:", err);
    res.status(500).json({ error: "Failed to update role." });
  }
});

// POST /admin/users/:id/plan — manual plan override (comped accounts etc.).
router.post("/admin/users/:id/plan", requireAdmin, async (req: Request, res: Response) => {
  const plan = req.body?.plan;
  if (plan !== "free" && plan !== "unlimited" && plan !== "api") {
    res.status(400).json({ error: "Invalid plan." });
    return;
  }
  try {
    const sb = getServiceClient();
    const { error } = await sb.from("subscriptions").upsert(
      {
        user_id: req.params.id,
        plan,
        status: plan === "free" ? "canceled" : "active",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error("admin set plan failed:", err);
    res.status(500).json({ error: "Failed to update plan." });
  }
});

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
    const secret = crypto.randomBytes(24).toString("base64url");
    const fullKey = `pk_live_${secret}`;
    const keyPrefix = fullKey.slice(0, 12);
    const keyHash = crypto.createHash("sha256").update(fullKey).digest("hex");

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

    res.json({ key: data, secret: fullKey });
  } catch (err) {
    console.error("admin issue api key failed:", err);
    res.status(500).json({ error: "Failed to issue API key." });
  }
});

router.delete("/admin/api-keys/:keyId", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { error } = await getServiceClient()
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", req.params.keyId);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error("admin revoke api key failed:", err);
    res.status(500).json({ error: "Failed to revoke API key." });
  }
});

export { router as adminRoutes };
