import crypto from "crypto";
import { getServiceClient } from "./supabase.js";

// API keys are shown to the user exactly once at creation time. Only a SHA-256
// hash and a short, non-secret prefix are persisted, so a database leak never
// exposes usable keys.
export const API_KEY_PREFIX = "pk_live_";

export interface GeneratedKey {
  fullKey: string;
  keyPrefix: string;
  keyHash: string;
}

export function generateApiKey(): GeneratedKey {
  const secret = crypto.randomBytes(24).toString("base64url");
  const fullKey = `${API_KEY_PREFIX}${secret}`;
  return {
    fullKey,
    keyPrefix: fullKey.slice(0, 12),
    keyHash: hashKey(fullKey),
  };
}

export function hashKey(fullKey: string): string {
  return crypto.createHash("sha256").update(fullKey).digest("hex");
}

export interface ResolvedKey {
  keyId: string;
  userId: string;
}

// Look up a presented key by its hash. Returns null for unknown or revoked
// keys. The lookup is an indexed equality on a 256-bit hash, so there is no
// app-level secret comparison to time-attack.
export async function resolveApiKey(fullKey: string): Promise<ResolvedKey | null> {
  if (!fullKey.startsWith(API_KEY_PREFIX)) return null;
  const { data, error } = await getServiceClient()
    .from("api_keys")
    .select("id, user_id, revoked_at")
    .eq("key_hash", hashKey(fullKey))
    .maybeSingle();
  if (error || !data || data.revoked_at) return null;
  return { keyId: data.id, userId: data.user_id };
}

// last_used_at is useful but not worth a write on every request. Throttle DB
// updates to at most once per key per interval, fire-and-forget.
const TOUCH_INTERVAL_MS = 60_000;
const lastTouched = new Map<string, number>();

// Prune stale throttle entries so the map can't grow without bound.
const touchEvict = setInterval(() => {
  const cutoff = Date.now() - TOUCH_INTERVAL_MS * 5;
  for (const [id, ts] of lastTouched) {
    if (ts < cutoff) lastTouched.delete(id);
  }
}, 10 * 60 * 1000);
touchEvict.unref?.();

// Per-key daily crop counter (analytics + future metered billing). Atomic via
// the increment_api_usage RPC.
export async function incrementApiUsage(keyId: string): Promise<number> {
  const { data, error } = await getServiceClient().rpc("increment_api_usage", {
    p_key: keyId,
  });
  if (error) throw error;
  return typeof data === "number" ? data : 0;
}

export async function getApiUsageToday(keyId: string): Promise<number> {
  const day = new Date().toISOString().slice(0, 10);
  const { data } = await getServiceClient()
    .from("api_usage")
    .select("count")
    .eq("key_id", keyId)
    .eq("day", day)
    .maybeSingle();
  return data?.count ?? 0;
}

export function touchLastUsed(keyId: string): void {
  const now = Date.now();
  const prev = lastTouched.get(keyId) ?? 0;
  if (now - prev < TOUCH_INTERVAL_MS) return;
  lastTouched.set(keyId, now);
  getServiceClient()
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyId)
    .then(
      () => {},
      (err: unknown) => console.error("touchLastUsed failed:", err)
    );
}
