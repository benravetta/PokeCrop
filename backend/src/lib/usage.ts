import { getServiceClient } from "./supabase.js";

export const FREE_DAILY_LIMIT = 3;

export type Plan = "free" | "unlimited" | "api";

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isUnlimited(plan: Plan): boolean {
  return plan === "unlimited" || plan === "api";
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
  if (active && (data.plan === "unlimited" || data.plan === "api")) {
    return data.plan;
  }
  return "free";
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
