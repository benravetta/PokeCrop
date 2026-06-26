export interface RateLimitPeek {
  count: number;
  limit: number;
  allowed: boolean;
  resetMs: number;
  retryAfterSec: number;
}

export interface RateLimitStore {
  /** Read current window usage without consuming. */
  peek(userId: string, action: string, windowMs: number, limit: number): Promise<RateLimitPeek>;
  /** Increment usage; returns false when already at or over limit. */
  consume(userId: string, action: string, windowMs: number, limit: number): Promise<boolean>;
  /** Peek and consume in one step (human-pregrade style). */
  checkAndIncrement(
    userId: string,
    action: string,
    windowMs: number,
    limit: number
  ): Promise<boolean>;
}

const buckets = new Map<string, { start: number; count: number }>();

function bucketKey(userId: string, action: string, windowMs: number, now: number): string {
  const windowStart = Math.floor(now / windowMs) * windowMs;
  return `${userId}:${action}:${windowStart}`;
}

function peekMemory(
  userId: string,
  action: string,
  windowMs: number,
  limit: number,
  now: number
): RateLimitPeek {
  const k = bucketKey(userId, action, windowMs, now);
  let b = buckets.get(k);
  if (!b || now - b.start >= windowMs) {
    b = { start: Math.floor(now / windowMs) * windowMs, count: 0 };
    buckets.set(k, b);
  }
  const resetMs = b.start + windowMs;
  return {
    count: b.count,
    limit,
    allowed: b.count < limit,
    resetMs,
    retryAfterSec: Math.max(1, Math.ceil((resetMs - now) / 1000)),
  };
}

export class MemoryRateLimitStore implements RateLimitStore {
  async peek(
    userId: string,
    action: string,
    windowMs: number,
    limit: number
  ): Promise<RateLimitPeek> {
    return peekMemory(userId, action, windowMs, limit, Date.now());
  }

  async consume(
    userId: string,
    action: string,
    windowMs: number,
    limit: number
  ): Promise<boolean> {
    const now = Date.now();
    const k = bucketKey(userId, action, windowMs, now);
    let b = buckets.get(k);
    if (!b || now - b.start >= windowMs) {
      b = { start: Math.floor(now / windowMs) * windowMs, count: 0 };
      buckets.set(k, b);
    }
    if (b.count >= limit) return false;
    b.count += 1;
    return true;
  }

  async checkAndIncrement(
    userId: string,
    action: string,
    windowMs: number,
    limit: number
  ): Promise<boolean> {
    return this.consume(userId, action, windowMs, limit);
  }
}

export class PostgresRateLimitStore implements RateLimitStore {
  private windowMeta(windowMs: number, now: number) {
    const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
    return {
      windowStart,
      expiresAt: new Date(windowStart.getTime() + windowMs * 2),
      resetMs: windowStart.getTime() + windowMs,
    };
  }

  private async readCount(bucketKey: string): Promise<number> {
    const { getServiceClient } = await import("./supabase.js");
    const { data: row } = await getServiceClient()
      .from("rate_limit_buckets")
      .select("count")
      .eq("bucket_key", bucketKey)
      .maybeSingle();
    return row?.count ?? 0;
  }

  async peek(
    userId: string,
    action: string,
    windowMs: number,
    limit: number
  ): Promise<RateLimitPeek> {
    const now = Date.now();
    const { windowStart, resetMs } = this.windowMeta(windowMs, now);
    const key = `${userId}:${action}:${windowStart.toISOString()}`;
    const count = await this.readCount(key);
    return {
      count,
      limit,
      allowed: count < limit,
      resetMs,
      retryAfterSec: Math.max(1, Math.ceil((resetMs - now) / 1000)),
    };
  }

  async consume(
    userId: string,
    action: string,
    windowMs: number,
    limit: number
  ): Promise<boolean> {
    const { getServiceClient } = await import("./supabase.js");
    const sb = getServiceClient();
    const now = Date.now();
    const { windowStart, expiresAt } = this.windowMeta(windowMs, now);
    const bucketKey = `${userId}:${action}:${windowStart.toISOString()}`;

    const { data, error } = await sb.rpc("consume_rate_limit_bucket", {
      p_bucket_key: bucketKey,
      p_limit: limit,
      p_window_start: windowStart.toISOString(),
      p_expires_at: expiresAt.toISOString(),
    });

    if (!error && typeof data === "boolean") return data;

    if (error) {
      console.warn("[rateLimit] RPC consume failed, falling back:", error.message);
    }

    return this.consumeWithRetry(sb, bucketKey, limit, windowStart, expiresAt);
  }

  /** Fallback when RPC is unavailable (local dev without migration). */
  private async consumeWithRetry(
    sb: ReturnType<typeof import("./supabase.js").getServiceClient>,
    bucketKey: string,
    limit: number,
    windowStart: Date,
    expiresAt: Date
  ): Promise<boolean> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const count = await this.readCount(bucketKey);
      if (count >= limit) return false;

      if (count > 0) {
        const { data, error } = await sb
          .from("rate_limit_buckets")
          .update({ count: count + 1 })
          .eq("bucket_key", bucketKey)
          .eq("count", count)
          .select("count")
          .maybeSingle();
        if (!error && data) return true;
        continue;
      }

      const { error: insertErr } = await sb.from("rate_limit_buckets").insert({
        bucket_key: bucketKey,
        count: 1,
        window_start: windowStart.toISOString(),
        expires_at: expiresAt.toISOString(),
      });
      if (!insertErr) return true;
      if (insertErr.code !== "23505") throw insertErr;
    }
    return false;
  }

  async checkAndIncrement(
    userId: string,
    action: string,
    windowMs: number,
    limit: number
  ): Promise<boolean> {
    return this.consume(userId, action, windowMs, limit);
  }
}

let store: RateLimitStore | null = null;

export function getRateLimitStore(): RateLimitStore {
  if (store) return store;
  const mode =
    process.env.RATE_LIMIT_STORE ||
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
