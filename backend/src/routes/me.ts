import { Router, Request, Response } from "express";
import { requireActiveAuth } from "../middleware/auth.js";
import { getServiceClient } from "../lib/supabase.js";
import { FREE_DAILY_LIMIT, getPlan, getUsageToday } from "../lib/usage.js";
import { getGradeCredits, getGradeQuota } from "../lib/gradeQuota.js";
import { getHistory, type UsageKind } from "../lib/usageEvents.js";
import { enrichHistoryEvents, updateHistoryEventCentring } from "../lib/historyEnrich.js";
import { parseCentering } from "../lib/gradeService.js";
import { isAdminRole } from "../lib/adminAccess.js";
import { signedGetUrl } from "../lib/r2.js";
import { artifactKeyFromDetail, isOwnedArtifactKey } from "../lib/gradeArtifacts.js";

const router = Router();

router.get("/me", requireActiveAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const admin = isAdminRole(req.user!.role);
  try {
    const [plan, used, gradeCredits, gradeQuota] = await Promise.all([
      getPlan(userId),
      getUsageToday(userId),
      getGradeCredits(userId),
      admin ? Promise.resolve(null) : getGradeQuota(userId, req.user!.role),
    ]);

    if (admin) {
      res.json({
        plan: null,
        cropsUsedToday: used,
        cropsRemaining: null,
        dailyLimit: null,
        gradeCredits,
        isAdmin: true,
      });
      return;
    }

    const cropsRemaining =
      plan === "free" ? Math.max(0, FREE_DAILY_LIMIT - used) : null;

    res.json({
      plan,
      cropsUsedToday: used,
      cropsRemaining,
      dailyLimit: plan === "free" ? FREE_DAILY_LIMIT : null,
      gradeCredits,
      gradeUsed: gradeQuota?.used ?? null,
      gradeLimit: gradeQuota?.limit ?? null,
      gradeAllowanceRemaining: gradeQuota?.allowanceRemaining ?? null,
      gradeRemaining: gradeQuota?.remaining ?? null,
      gradeWindow: gradeQuota?.window ?? null,
      isAdmin: false,
    });
  } catch (err) {
    console.error("/me failed:", err);
    res.status(500).json({ error: "Failed to load account." });
  }
});

router.get("/me/history", requireActiveAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  try {
    const kindRaw = typeof req.query.kind === "string" ? req.query.kind : "";
    const kind: UsageKind | undefined =
      kindRaw === "crop" || kindRaw === "grade" ? kindRaw : undefined;
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

    const result = await getHistory({
      userId,
      kind,
      q: str(req.query.q),
      from: str(req.query.from),
      to: str(req.query.to),
      page: req.query.page ? parseInt(String(req.query.page), 10) : undefined,
      pageSize: req.query.pageSize ? parseInt(String(req.query.pageSize), 10) : undefined,
    });
    const events = await enrichHistoryEvents(result.events);
    res.json({ ...result, events });
  } catch (err) {
    console.error("/me/history failed:", err);
    res.status(500).json({ error: "Failed to load history." });
  }
});

router.patch("/me/history/:id/centring", requireActiveAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const eventId = parseInt(req.params.id, 10);
  if (!Number.isFinite(eventId)) {
    res.status(400).json({ error: "Invalid history id." });
    return;
  }
  const body = req.body as { front?: { leftRight?: string; topBottom?: string } };
  const parsed = parseCentering({ front: body?.front });
  if (!parsed?.front) {
    res.status(400).json({
      error: "Provide valid front.leftRight and/or front.topBottom ratios (e.g. 55/45).",
    });
    return;
  }
  try {
    const centring = await updateHistoryEventCentring(userId, eventId, parsed.front);
    if (!centring) {
      res.status(404).json({ error: "Crop history entry not found." });
      return;
    }
    res.json({ centring });
  } catch (err) {
    console.error("/me/history centring failed:", err);
    res.status(500).json({ error: "Failed to save centring." });
  }
});

router.get("/me/history/:id/download", requireActiveAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const eventId = parseInt(req.params.id, 10);
  const type = req.query.type === "zip" ? "zip" : "pdf";
  if (!Number.isFinite(eventId)) {
    res.status(400).json({ error: "Invalid history id." });
    return;
  }
  try {
    const { data, error } = await getServiceClient()
      .from("usage_events")
      .select("id, kind, detail")
      .eq("id", eventId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!data || data.kind !== "grade") {
      res.status(404).json({ error: "Grade not found." });
      return;
    }
    const detail = (data.detail ?? {}) as Record<string, unknown>;
    const key = artifactKeyFromDetail(detail, type);
    if (!key || !isOwnedArtifactKey(key, userId)) {
      res.status(404).json({ error: "Download not available for this grade." });
      return;
    }
    const url = await signedGetUrl(key, 900);
    if (!url) {
      res.status(503).json({ error: "File storage is not available." });
      return;
    }
    res.json({ url, expiresIn: 900, type });
  } catch (err) {
    console.error("/me/history download failed:", err);
    res.status(500).json({ error: "Failed to create download link." });
  }
});

router.get("/me/profile", requireActiveAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  try {
    const { data, error } = await getServiceClient()
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    res.json({
      displayName:
        typeof data?.display_name === "string" ? data.display_name : null,
    });
  } catch (err) {
    console.error("/me/profile GET failed:", err);
    res.status(500).json({ error: "Failed to load profile." });
  }
});

router.patch("/me/profile", requireActiveAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const raw = req.body?.displayName;
  const displayName =
    typeof raw === "string" ? raw.trim().slice(0, 100) || null : null;
  try {
    const { error } = await getServiceClient()
      .from("profiles")
      .upsert(
        { id: userId, display_name: displayName },
        { onConflict: "id" }
      );
    if (error) throw error;
    res.json({ displayName });
  } catch (err) {
    console.error("/me/profile PATCH failed:", err);
    res.status(500).json({ error: "Failed to save profile." });
  }
});

export { router as meRoutes };
