// Backward-compatible re-exports. Prefer accountRateLimit for new code.
export {
  DAILY_SOFT_CAP,
  WINDOW_MS,
  consumeApiRateLimit,
  peekApiRateLimit,
  rateLimitHeaders,
  type RateResult,
} from "./accountRateLimit.js";

export const RATE_PER_MIN = 60;
export const STRAIGHTEN_RATE_PER_MIN = 30;

export type RateBucket = "crop" | "straighten";

/** @deprecated Use peekApiRateLimit */
export async function peekRateLimit(
  accountId: string,
  bucket: RateBucket = "crop"
): Promise<import("./accountRateLimit.js").RateResult> {
  return peekApiRateLimit(accountId, bucket);
}

/** @deprecated Use consumeApiRateLimit */
export async function consumeRateLimit(
  accountId: string,
  bucket: RateBucket = "crop"
): Promise<void> {
  return consumeApiRateLimit(accountId, bucket);
}

import { peekApiRateLimit, consumeApiRateLimit } from "./accountRateLimit.js";

/** @deprecated Use peekApiRateLimit + consumeApiRateLimit */
export async function rateLimit(
  accountId: string,
  opts: { peek?: boolean; bucket?: RateBucket } = {}
): Promise<import("./accountRateLimit.js").RateResult> {
  const bucket = opts.bucket ?? "crop";
  const peek = await peekApiRateLimit(accountId, bucket);
  if (opts.peek || !peek.allowed) return peek;
  await consumeApiRateLimit(accountId, bucket);
  return peekApiRateLimit(accountId, bucket);
}
