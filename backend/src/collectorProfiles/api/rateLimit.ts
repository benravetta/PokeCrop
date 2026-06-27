import type { Request, Response, NextFunction } from "express";
import { getRateLimitStore } from "../../humanPregrade/api/rateLimitStore.js";
import { getCollectorProfileSettings } from "../infrastructure/settingsRepo.js";

const WINDOW_MS = 60_000;

export function collectorRateLimit(action: string, fallbackLimit = 30) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      next();
      return;
    }
    try {
      let limit = fallbackLimit;
      const settings = await getCollectorProfileSettings();
      if (action === "message") limit = settings.max_messages_per_minute;
      if (action === "conversation") limit = settings.max_new_conversations_per_hour;
      if (action === "trade") limit = settings.max_trade_enquiries_per_day;

      const allowed = await getRateLimitStore().checkAndIncrement(
        userId,
        `collector:${action}`,
        action === "trade" ? 86400000 : action === "conversation" ? 3600000 : WINDOW_MS,
        limit
      );
      if (!allowed) {
        res.status(429).json({ error: "Too many requests.", error_code: "COLLECTOR_RATE_LIMIT" });
        return;
      }
      next();
    } catch (err) {
      console.error("[collectorProfiles] rate limit error:", err);
      res.status(503).json({ error: "Rate limit unavailable.", error_code: "COLLECTOR_RATE_LIMIT" });
    }
  };
}
