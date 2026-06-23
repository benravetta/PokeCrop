import { getServiceClient } from "./supabase.js";
import { hasUnlimitedCrops, type Plan } from "./plans.js";

export { type Plan } from "./plans.js";
export const FREE_DAILY_LIMIT = 3;

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isUnlimited(plan: Plan): boolean {
  return hasUnlimitedCrops(plan);
}

// Effective plan: a paid plan only counts while its subscription is active.
export async function getPlan(userId: string): Promise<Plan> {
  const { data } = await getServiceClient()
    .from("subscriptions")
    .select("plan, status")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return "free";
  const active = data.status === "active" || data.status === "trialing";
  if (
    active &&
    (data.plan === "unlimited" || data.plan === "pro" || data.plan === "api")
  ) {
    return data.plan;
  }
  return "free";
}

// Whether an account is currently suspended (Supabase native ban). Fail-open on
// transient errors so a Supabase blip can't take down all API traffic; the
// admin suspend action also revokes keys for immediate, durable effect.
export async function isSuspended(userId: string): Promise<boolean> {
  try {
    const { data, error } = await getServiceClient().auth.admin.getUserById(userId);
    if (error || !data?.user) return false;
    const bannedUntil = (data.user as unknown as { banned_until?: string | null })
      .banned_until;
    return Boolean(bannedUntil && new Date(bannedUntil) > new Date());
  } catch (err) {
    console.error("suspension check failed:", err);
    return false;
  }
}

export async function getUsageToday(userId: string): Promise<number> {
  const { data } = await getServiceClient()
    .from("usage_days")
    .select("crop_count")
    .eq("user_id", userId)
    .eq("day", utcDay())
    .maybeSingle();
  return data?.crop_count ?? 0;
}

export async function incrementUsage(userId: string): Promise<number> {
  const { data, error } = await getServiceClient().rpc("increment_daily_crop", {
    p_user: userId,
  });
  if (error) throw error;
  return typeof data === "number" ? data : 0;
}
