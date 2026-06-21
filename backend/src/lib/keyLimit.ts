import { getServiceClient } from "./supabase.js";

// Default ceiling on active API keys per account. An admin can raise or lower
// this per user via subscriptions.max_api_keys; null falls back to this value.
export const DEFAULT_MAX_ACTIVE_KEYS = 10;

// Absolute ceiling an admin may set, to keep the per-account footprint bounded.
export const MAX_KEY_LIMIT = 100;

export async function getKeyLimitOverride(userId: string): Promise<number | null> {
  const { data } = await getServiceClient()
    .from("subscriptions")
    .select("max_api_keys")
    .eq("user_id", userId)
    .maybeSingle();
  const v = (data as { max_api_keys?: number | null } | null)?.max_api_keys;
  return typeof v === "number" ? v : null;
}

export async function effectiveKeyLimit(userId: string): Promise<number> {
  const override = await getKeyLimitOverride(userId);
  return override ?? DEFAULT_MAX_ACTIVE_KEYS;
}
