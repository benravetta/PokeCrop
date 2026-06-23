import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { FREE_DAILY_LIMIT, getPlan, getUsageToday } from "../lib/usage.js";
import { getGradeCredits } from "../lib/gradeQuota.js";
import { getHistory, type UsageKind } from "../lib/usageEvents.js";

const router = Router();

// Plan + usage snapshot for the signed-in user. Drives the remaining-crops
// indicator and the account page.
router.get("/me", requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  try {
    const [plan, used, gradeCredits] = await Promise.all([
      getPlan(userId),
      getUsageToday(userId),
      getGradeCredits(userId),
    ]);
    const cropsRemaining =
      plan === "free" ? Math.max(0, FREE_DAILY_LIMIT - used) : null;

    res.json({
      plan,
      cropsUsedToday: used,
      cropsRemaining,
      dailyLimit: plan === "free" ? FREE_DAILY_LIMIT : null,
      gradeCredits,
      isAdmin: req.user!.role === "admin",
    });
  } catch (err) {
    console.error("/me failed:", err);
    res.status(500).json({ error: "Failed to load account." });
  }
});

// Searchable, paginated history of the signed-in user's crops and grades.
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
    res.json(result);
  } catch (err) {
    console.error("/me/history failed:", err);
    res.status(500).json({ error: "Failed to load history." });
  }
});

export { router as meRoutes };
