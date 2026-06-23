// In-memory rate limiting for the public API. Safe on a single Fly machine;
// move to Postgres/Redis if scaled horizontally.

export const RATE_PER_MIN = parseInt(process.env.API_RATE_PER_MIN || "60", 10);
export const STRAIGHTEN_RATE_PER_MIN = parseInt(
  process.env.API_STRAIGHTEN_RATE_PER_MIN || "30",
  10
);
export const DAILY_SOFT_CAP = parseInt(
  process.env.API_DAILY_SOFT_CAP || "5000",
  10
);

export type RateBucket = "crop" | "straighten";

const WINDOW_MS = 60_000;

interface BucketState {
  windowStart: number;
  count: number;
  day: string;
  dayCount: number;
  lastSeen: number;
}

const states = new Map<string, BucketState>();

const IDLE_TTL_MS = 25 * 60 * 60 * 1000;
const evictTimer = setInterval(() => {
  const cutoff = Date.now() - IDLE_TTL_MS;
  for (const [id, s] of states) {
    if (s.lastSeen < cutoff) states.delete(id);
  }
}, 60 * 60 * 1000);
evictTimer.unref?.();

function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

function secondsToUtcMidnight(now: number): number {
  const d = new Date(now);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  return Math.ceil((next - now) / 1000);
}

function stateKey(accountId: string, bucket: RateBucket): string {
  return `${accountId}:${bucket}`;
}

function perMinuteLimit(bucket: RateBucket): number {
  return bucket === "straighten" ? STRAIGHTEN_RATE_PER_MIN : RATE_PER_MIN;
}

function getState(accountId: string, bucket: RateBucket, now: number): BucketState {
  const key = stateKey(accountId, bucket);
  let s = states.get(key);
  if (!s) {
    s = { windowStart: now, count: 0, day: utcDay(now), dayCount: 0, lastSeen: now };
    states.set(key, s);
  }
  s.lastSeen = now;
  if (now - s.windowStart >= WINDOW_MS) {
    s.windowStart = now;
    s.count = 0;
  }
  if (s.day !== utcDay(now)) {
    s.day = utcDay(now);
    s.dayCount = 0;
  }
  return s;
}

export interface RateResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
  retryAfterSec: number;
  reason?: "minute" | "daily";
  message?: string;
}

/** Check limits without consuming quota (use before work; call consume on success). */
export function peekRateLimit(
  accountId: string,
  bucket: RateBucket = "crop"
): RateResult {
  const now = Date.now();
  const s = getState(accountId, bucket, now);
  const limit = perMinuteLimit(bucket);
  const base: RateResult = {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - s.count),
    resetMs: s.windowStart + WINDOW_MS,
    retryAfterSec: Math.max(1, Math.ceil((s.windowStart + WINDOW_MS - now) / 1000)),
  };

  if (bucket === "crop" && s.dayCount >= DAILY_SOFT_CAP) {
    return {
      ...base,
      allowed: false,
      reason: "daily",
      message: "Daily request cap reached. Contact support to raise your limit.",
      retryAfterSec: secondsToUtcMidnight(now),
    };
  }

  if (s.count >= limit) {
    return {
      ...base,
      allowed: false,
      remaining: 0,
      reason: "minute",
      message: "Rate limit exceeded. Slow down.",
    };
  }

  return base;
}

/** Consume one request against the account bucket (call only after successful work). */
export function consumeRateLimit(accountId: string, bucket: RateBucket = "crop"): void {
  const now = Date.now();
  const s = getState(accountId, bucket, now);
  s.count += 1;
  if (bucket === "crop") s.dayCount += 1;
}

/** @deprecated Use peekRateLimit + consumeRateLimit */
export function rateLimit(
  accountId: string,
  opts: { peek?: boolean; bucket?: RateBucket } = {}
): RateResult {
  const bucket = opts.bucket ?? "crop";
  const peek = peekRateLimit(accountId, bucket);
  if (opts.peek || !peek.allowed) return peek;
  consumeRateLimit(accountId, bucket);
  return peekRateLimit(accountId, bucket);
}

export function rateLimitHeaders(r: RateResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(r.limit),
    "X-RateLimit-Remaining": String(r.remaining),
    "X-RateLimit-Reset": String(Math.floor(r.resetMs / 1000)),
  };
}
