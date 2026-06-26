import type { Request, Response, NextFunction } from "express";
import {
  peekWebRateLimit,
  rateLimitHeaders,
  type WebRateAction,
} from "../lib/accountRateLimit.js";

/** Peek web rate limits without consuming — call consumeWebRateLimitSlot after success. */
export function webRateLimitPeek(action: WebRateAction) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    try {
      const limit = await peekWebRateLimit(userId, action);
      res.set(rateLimitHeaders(limit));
      if (!limit.allowed) {
        res.set("Retry-After", String(limit.retryAfterSec));
        res.status(429).json({ error: limit.message ?? "Rate limit exceeded. Slow down." });
        return;
      }
      next();
    } catch (err) {
      console.error("[webRateLimit] store error:", err);
      res.status(503).json({ error: "Service temporarily unavailable. Please try again shortly." });
    }
  };
}

/** @deprecated Alias for webRateLimitPeek */
export const webRateLimit = webRateLimitPeek;
