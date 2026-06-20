import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { FREE_DAILY_LIMIT, getPlan, getUsageToday } from "../lib/usage.js";

const router = Router();

// Plan + usage snapshot for the signed-in user. Drives the remaining-crops
// indicator and the account page.
router.get("/me", requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  try {
    const [plan, used] = await Promise.all([
      getPlan(userId),
      getUsageToday(userId),
    ]);
    const cropsRemaining =
      plan === "free" ? Math.max(0, FREE_DAILY_LIMIT - used) : null;

    res.json({
      plan,
      cropsUsedToday: used,
      cropsRemaining,
      dailyLimit: plan === "free" ? FREE_DAILY_LIMIT : null,
      isAdmin: req.user!.role === "admin",
    });
  } catch (err) {
    console.error("/me failed:", err);
    res.status(500).json({ error: "Failed to load account." });
  }
});

export { router as meRoutes };
