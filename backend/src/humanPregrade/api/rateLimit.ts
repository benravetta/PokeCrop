import type { Request, Response, NextFunction } from "express";
import { getRateLimitStore } from "./rateLimitStore.js";

const WINDOW_MS = 60_000;

const LIMITS: Record<string, number> = {
  create: 10,
  upload: 30,
  checkout: 10,
  message: 20,
};

export function humanPregradeRateLimit(action: keyof typeof LIMITS) {
  const limit = LIMITS[action] ?? 30;
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      next();
      return;
    }
    try {
      const allowed = await getRateLimitStore().checkAndIncrement(
        userId,
        action,
        WINDOW_MS,
        limit
      );
      if (!allowed) {
        res.status(429).json({ error: "Too many requests. Please try again shortly." });
        return;
      }
      next();
    } catch (err) {
      console.error("[humanPregrade] rate limit error:", err);
      next();
    }
  };
}
