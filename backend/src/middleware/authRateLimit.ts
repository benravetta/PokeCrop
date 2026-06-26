import type { Request, Response, NextFunction } from "express";
import { getRateLimitStore } from "../lib/rateLimitStore.js";

const WINDOW_MS = 60_000;
const LIMITS: Record<string, number> = {
  invite_validate: 30,
  signup: 10,
};

/** Per-IP rate limit for unauthenticated auth routes. */
export function authIpRateLimit(action: keyof typeof LIMITS) {
  const limit = LIMITS[action] ?? 20;
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = req.ip || "unknown";
    try {
      const allowed = await getRateLimitStore().checkAndIncrement(
        `auth:ip:${ip}`,
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
      console.error("[auth] rate limit error:", err);
      res.status(503).json({ error: "Service temporarily unavailable. Please try again shortly." });
    }
  };
}
