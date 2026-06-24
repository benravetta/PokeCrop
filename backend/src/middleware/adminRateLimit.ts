import type { Response } from "express";

const READ_PER_MIN = parseInt(process.env.ADMIN_READ_RATE_PER_MIN || "120", 10);
const MUTATE_PER_MIN = parseInt(process.env.ADMIN_MUTATE_RATE_PER_MIN || "30", 10);
const WINDOW_MS = 60_000;

interface Bucket {
  windowStart: number;
  read: number;
  mutate: number;
  lastSeen: number;
}

const buckets = new Map<string, Bucket>();

const evictTimer = setInterval(() => {
  const cutoff = Date.now() - 25 * 60 * 60 * 1000;
  for (const [id, b] of buckets) {
    if (b.lastSeen < cutoff) buckets.delete(id);
  }
}, 60 * 60 * 1000);
evictTimer.unref?.();

function bucketFor(adminId: string, now: number): Bucket {
  let b = buckets.get(adminId);
  if (!b) {
    b = { windowStart: now, read: 0, mutate: 0, lastSeen: now };
    buckets.set(adminId, b);
  }
  b.lastSeen = now;
  if (now - b.windowStart >= WINDOW_MS) {
    b.windowStart = now;
    b.read = 0;
    b.mutate = 0;
  }
  return b;
}

export function checkAdminRateLimit(
  adminId: string,
  res: Response,
  opts: { mutating?: boolean } = {}
): boolean {
  const now = Date.now();
  const b = bucketFor(adminId, now);
  const limit = opts.mutating ? MUTATE_PER_MIN : READ_PER_MIN;
  const used = opts.mutating ? b.mutate : b.read;
  if (used >= limit) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((b.windowStart + WINDOW_MS - now) / 1000)
    );
    res.set("Retry-After", String(retryAfterSec));
    res.status(429).json({ error: "Admin rate limit exceeded. Slow down." });
    return false;
  }
  if (opts.mutating) b.mutate += 1;
  else b.read += 1;
  return true;
}
