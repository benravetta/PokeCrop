import { getServiceClient } from "./supabase.js";
import { getPlan, type Plan } from "./usage.js";

// Grading is costlier than cropping, so quotas are tighter:
//   free      -> 1 / month
//   unlimited -> 10 / day
//   api       -> 20 / day
function planLimit(plan: Plan): { limit: number; window: "day" | "month" } {
  if (plan === "api") return { limit: 20, window: "day" };
  if (plan === "unlimited") return { limit: 10, window: "day" };
  return { limit: 1, window: "month" };
}

export interface GradeQuota {
  plan: Plan;
  limit: number;
  used: number;
  remaining: number;
  window: "day" | "month";
}

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

function utcMonthStart(): string {
  return `${new Date().toISOString().slice(0, 7)}-01`;
}

async function usedToday(userId: string): Promise<number> {
  const { data } = await getServiceClient()
    .from("grade_usage")
    .select("count")
    .eq("user_id", userId)
    .eq("day", utcDay())
    .maybeSingle();
  return data?.count ?? 0;
}

async function usedThisMonth(userId: string): Promise<number> {
  const { data } = await getServiceClient()
    .from("grade_usage")
    .select("count")
    .eq("user_id", userId)
    .gte("day", utcMonthStart());
  return (data ?? []).reduce((sum, r) => sum + (r.count ?? 0), 0);
}

export async function getGradeQuota(userId: string): Promise<GradeQuota> {
  const plan = await getPlan(userId);
  const { limit, window } = planLimit(plan);
  const used = window === "day" ? await usedToday(userId) : await usedThisMonth(userId);
  return { plan, limit, used, remaining: Math.max(0, limit - used), window };
}

// Atomic increment of today's grade count; returns today's new count.
export async function incrementGrade(userId: string): Promise<number> {
  const { data, error } = await getServiceClient().rpc("increment_grade", {
    p_user: userId,
  });
  if (error) throw error;
  return typeof data === "number" ? data : 0;
}
