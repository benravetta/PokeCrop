export interface RateLimitStore {
  /** Returns true if request is allowed, false if over limit. */
  checkAndIncrement(userId: string, action: string, windowMs: number, limit: number): Promise<boolean>;
}

const buckets = new Map<string, { start: number; count: number }>();

export class MemoryRateLimitStore implements RateLimitStore {
  async checkAndIncrement(
    userId: string,
    action: string,
    windowMs: number,
    limit: number
  ): Promise<boolean> {
    const now = Date.now();
    const k = `${userId}:${action}`;
    let b = buckets.get(k);
    if (!b || now - b.start >= windowMs) {
      b = { start: now, count: 0 };
      buckets.set(k, b);
    }
    b.count += 1;
    return b.count <= limit;
  }
}

export class PostgresRateLimitStore implements RateLimitStore {
  async checkAndIncrement(
    userId: string,
    action: string,
    windowMs: number,
    limit: number
  ): Promise<boolean> {
    const { getServiceClient } = await import("../../lib/supabase.js");
    const sb = getServiceClient();
    const now = Date.now();
    const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
    const bucketKey = `${userId}:${action}:${windowStart.toISOString()}`;
    const expiresAt = new Date(windowStart.getTime() + windowMs * 2);

    const { data: row } = await sb
      .from("rate_limit_buckets")
      .select("count")
      .eq("bucket_key", bucketKey)
      .maybeSingle();

    if (row && row.count >= limit) return false;

    if (row) {
      const { error } = await sb
        .from("rate_limit_buckets")
        .update({ count: row.count + 1 })
        .eq("bucket_key", bucketKey);
      if (error) throw error;
    } else {
      const { error } = await sb.from("rate_limit_buckets").insert({
        bucket_key: bucketKey,
        count: 1,
        window_start: windowStart.toISOString(),
        expires_at: expiresAt.toISOString(),
      });
      if (error) throw error;
    }
    return true;
  }
}

let store: RateLimitStore | null = null;

export function getRateLimitStore(): RateLimitStore {
  if (store) return store;
  const mode =
    process.env.HUMAN_PREGRADE_RATE_LIMIT_STORE ||
    (process.env.NODE_ENV === "production" ? "postgres" : "memory");
  store = mode === "postgres" ? new PostgresRateLimitStore() : new MemoryRateLimitStore();
  return store;
}

/** Test hook */
export function resetRateLimitStoreForTests(): void {
  store = null;
  buckets.clear();
}
