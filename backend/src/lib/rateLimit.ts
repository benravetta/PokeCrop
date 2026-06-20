// In-memory rate limiting for the public API. Safe because the app runs as a
// single Fly machine (min_machines_running=1); if it is ever scaled out this
// must move to a shared store (e.g. Postgres or Redis).
//
// Two guards per key:
//   1. A fixed 60s window cap (requests/minute) to stop bursts.
//   2. A generous daily soft cap as an abuse backstop. The "api" plan is
//      unlimited for normal use; this only trips on clearly abusive volume.

export const RATE_PER_MIN = parseInt(process.env.API_RATE_PER_MIN || "60", 10);
export const DAILY_SOFT_CAP = parseInt(
  process.env.API_DAILY_SOFT_CAP || "5000",
  10
);

const WINDOW_MS = 60_000;

interface KeyState {
  windowStart: number;
  count: number;
  day: string;
  dayCount: number;
  lastSeen: number;
}

const states = new Map<string, KeyState>();

// Evict keys idle for over a day so the map can't grow without bound. Safe
// because the daily soft cap only needs to track active (non-idle) keys.
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
  const next = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() + 1
  );
  return Math.ceil((next - now) / 1000);
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

export function rateLimit(
  keyId: string,
  opts: { peek?: boolean } = {}
): RateResult {
  const now = Date.now();
  const today = utcDay(now);

  let s = states.get(keyId);
  if (!s) {
    s = { windowStart: now, count: 0, day: today, dayCount: 0, lastSeen: now };
    states.set(keyId, s);
  }
  s.lastSeen = now;

  if (now - s.windowStart >= WINDOW_MS) {
    s.windowStart = now;
    s.count = 0;
  }
  if (s.day !== today) {
    s.day = today;
    s.dayCount = 0;
  }

  const base: RateResult = {
    allowed: true,
    limit: RATE_PER_MIN,
    remaining: Math.max(0, RATE_PER_MIN - s.count),
    resetMs: s.windowStart + WINDOW_MS,
    retryAfterSec: Math.max(
      1,
      Math.ceil((s.windowStart + WINDOW_MS - now) / 1000)
    ),
  };

  if (opts.peek) return base;

  if (s.dayCount >= DAILY_SOFT_CAP) {
    return {
      ...base,
      allowed: false,
      reason: "daily",
      message: "Daily request cap reached. Contact support to raise your limit.",
      retryAfterSec: secondsToUtcMidnight(now),
    };
  }

  if (s.count >= RATE_PER_MIN) {
    return {
      ...base,
      allowed: false,
      remaining: 0,
      reason: "minute",
      message: "Rate limit exceeded. Slow down.",
    };
  }

  s.count += 1;
  s.dayCount += 1;
  return { ...base, remaining: Math.max(0, RATE_PER_MIN - s.count) };
}

export function rateLimitHeaders(r: RateResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(r.limit),
    "X-RateLimit-Remaining": String(r.remaining),
    "X-RateLimit-Reset": String(Math.floor(r.resetMs / 1000)),
  };
}
