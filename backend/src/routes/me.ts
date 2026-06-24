import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { FREE_DAILY_LIMIT, getPlan, getUsageToday } from "../lib/usage.js";
import { getGradeCredits } from "../lib/gradeQuota.js";
import { getHistory, type UsageKind } from "../lib/usageEvents.js";
import { enrichHistoryEvents, updateHistoryEventCentring } from "../lib/historyEnrich.js";
import { ADMIN_EFFECTIVE_PLAN, isAdminRole } from "../lib/adminAccess.js";

const router = Router();

router.get("/me", requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const admin = isAdminRole(req.user!.role);
  try {
    const [plan, used, gradeCredits] = await Promise.all([
      getPlan(userId),
      getUsageToday(userId),
      getGradeCredits(userId),
    ]);

    if (admin) {
      res.json({
        plan: ADMIN_EFFECTIVE_PLAN,
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
      isAdmin: false,
    });
  } catch (err) {
    console.error("/me failed:", err);
    res.status(500).json({ error: "Failed to load account." });
  }
});

router.get("/me/history", requireAuth, async (req: Request, res: Response) => {
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

router.patch("/me/history/:id/centring", requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const eventId = parseInt(req.params.id, 10);
  if (!Number.isFinite(eventId)) {
    res.status(400).json({ error: "Invalid history id." });
    return;
  }
  const body = req.body as { front?: { leftRight?: string; topBottom?: string } };
  const front = body?.front;
  if (!front || (typeof front.leftRight !== "string" && typeof front.topBottom !== "string")) {
    res.status(400).json({ error: "Provide front.leftRight and/or front.topBottom ratios." });
    return;
  }
  try {
    const centring = await updateHistoryEventCentring(userId, eventId, front);
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

export { router as meRoutes };
