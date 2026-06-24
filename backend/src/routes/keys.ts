import { Router, Request, Response, NextFunction } from "express";
import { requireActiveAuth } from "../middleware/auth.js";
import { getServiceClient } from "../lib/supabase.js";
import { getPlan } from "../lib/usage.js";
import { generateApiKey } from "../lib/apiKeys.js";
import { logActivity } from "../lib/activity.js";
import { effectiveKeyLimit } from "../lib/keyLimit.js";
import { effectivePlan } from "../lib/adminAccess.js";

const router = Router();

// Self-serve API key management for API-tier users. Keys are always scoped to
// the authenticated user; admins manage other users' keys via /api/admin/*.
async function requireApiPlan(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const plan = effectivePlan(await getPlan(req.user!.id), req.user!.role);
    if (plan !== "api") {
      res
        .status(403)
        .json({ error: "API keys require the Enterprise plan. Upgrade at /pricing." });
      return;
    }
    next();
  } catch (err) {
    console.error("plan check failed:", err);
    res.status(503).json({ error: "Could not verify your plan." });
  }
}

router.get(
  "/keys",
  requireActiveAuth,
  requireApiPlan,
  async (req: Request, res: Response) => {
    try {
      const { data, error } = await getServiceClient()
        .from("api_keys")
        .select("id, label, key_prefix, created_at, last_used_at, revoked_at")
        .eq("user_id", req.user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      res.json({ keys: data ?? [] });
    } catch (err) {
      console.error("list keys failed:", err);
      res.status(500).json({ error: "Failed to load API keys." });
    }
  }
);

router.post(
  "/keys",
  requireActiveAuth,
  requireApiPlan,
  async (req: Request, res: Response) => {
    const label =
      typeof req.body?.label === "string" ? req.body.label.slice(0, 80) : null;
    try {
      // Cap active keys per account so keys can't be farmed to amplify limits.
      // The cap is the per-user override (set by an admin) or the global default.
      const [{ count, error: countErr }, limit] = await Promise.all([
        getServiceClient()
          .from("api_keys")
          .select("id", { count: "exact", head: true })
          .eq("user_id", req.user!.id)
          .is("revoked_at", null),
        effectiveKeyLimit(req.user!.id),
      ]);
      if (countErr) throw countErr;
      if ((count ?? 0) >= limit) {
        res.status(409).json({
          error: `You can have at most ${limit} active API keys. Revoke one first.`,
        });
        return;
      }

      const { fullKey, keyPrefix, keyHash } = generateApiKey();
      const { data, error } = await getServiceClient()
        .from("api_keys")
        .insert({
          user_id: req.user!.id,
          label,
          key_prefix: keyPrefix,
          key_hash: keyHash,
        })
        .select("id, label, key_prefix, created_at")
        .single();
      if (error) throw error;
      logActivity({
        userId: req.user!.id,
        action: "key.created",
        actorId: req.user!.id,
        actorEmail: req.user!.email ?? null,
        detail: { key_id: data.id, label, key_prefix: keyPrefix },
      });
      // The full key is returned ONCE; only its hash + prefix are stored.
      res.json({ key: data, secret: fullKey });
    } catch (err) {
      console.error("create key failed:", err);
      res.status(500).json({ error: "Failed to create API key." });
    }
  }
);

router.delete(
  "/keys/:id",
  requireActiveAuth,
  requireApiPlan,
  async (req: Request, res: Response) => {
    try {
      // Only revoke a currently-active key the caller owns, so we can log a
      // real revocation (and not a no-op on an already-revoked/foreign key).
      const { data, error } = await getServiceClient()
        .from("api_keys")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", req.params.id)
        .eq("user_id", req.user!.id)
        .is("revoked_at", null)
        .select("id, key_prefix")
        .maybeSingle();
      if (error) throw error;
      if (data) {
        logActivity({
          userId: req.user!.id,
          action: "key.revoked",
          actorId: req.user!.id,
          actorEmail: req.user!.email ?? null,
          detail: { key_id: data.id, key_prefix: data.key_prefix },
        });
      }
      res.json({ ok: true });
    } catch (err) {
      console.error("revoke key failed:", err);
      res.status(500).json({ error: "Failed to revoke API key." });
    }
  }
);

export { router as keyRoutes };
