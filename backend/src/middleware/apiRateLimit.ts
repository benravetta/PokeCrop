import type { Request, Response, NextFunction } from "express";
import {
  peekApiActionRateLimit,
  rateLimitHeaders,
  type ApiRateAction,
} from "../lib/accountRateLimit.js";
import { sendApiError } from "../lib/apiError.js";

/** Peek API action limits without consuming — call consumeApiActionRateLimitSlot after success. */
export function apiRateLimitPeek(action: ApiRateAction) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.apiUser?.userId;
    if (!userId) {
      sendApiError(res, "unauthorized", "Missing or invalid API key.");
      return;
    }
    try {
      const limit = await peekApiActionRateLimit(userId, action);
      res.set(rateLimitHeaders(limit));
      if (!limit.allowed) {
        sendApiError(
          res,
          "rate_limited",
          limit.message ?? "Rate limit exceeded. Slow down.",
          { "Retry-After": String(limit.retryAfterSec) }
        );
        return;
      }
      next();
    } catch (err) {
      console.error("[apiRateLimit] store error:", err);
      sendApiError(res, "internal_error", "Service temporarily unavailable.");
    }
  };
}

/** @deprecated Alias for apiRateLimitPeek */
export const apiRateLimit = apiRateLimitPeek;
