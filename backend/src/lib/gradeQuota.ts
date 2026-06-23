import { getServiceClient } from "./supabase.js";
import { getPlan, type Plan } from "./usage.js";

// Grading is costlier than cropping, so quotas are tighter:
//   free      -> 1 / month
//   unlimited (Premium) -> 30 / month
//   pro       -> 100 / month
//   api       (Enterprise) -> 100 / month + REST API access
function planLimit(plan: Plan): { limit: number; window: "day" | "month" } {
  if (plan === "api" || plan === "pro") return { limit: 100, window: "month" };
  if (plan === "unlimited") return { limit: 30, window: "month" };
  return { limit: 1, window: "month" };
}

export interface GradeQuota {
  plan: Plan;
  limit: number;
  used: number;
  // Effective remaining = plan allowance left + purchased credits.
  remaining: number;
  window: "day" | "month";
  // Allowance left from the plan alone (excludes purchased credits).
  allowanceRemaining: number;
  // One-off grade credits the user has purchased and not yet consumed.
  credits: number;
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

// Purchased one-off grade credits remaining on the account (0 if none).
export async function getGradeCredits(userId: string): Promise<number> {
  const { data } = await getServiceClient()
    .from("subscriptions")
    .select("grade_credits")
    .eq("user_id", userId)
    .maybeSingle();
  return Math.max(0, data?.grade_credits ?? 0);
}

export async function getGradeQuota(userId: string): Promise<GradeQuota> {
  const plan = await getPlan(userId);
  const { limit, window } = planLimit(plan);
  const used = window === "day" ? await usedToday(userId) : await usedThisMonth(userId);
  const credits = await getGradeCredits(userId);
  const allowanceRemaining = Math.max(0, limit - used);
  return {
    plan,
    limit,
    used,
    window,
    allowanceRemaining,
    credits,
    remaining: allowanceRemaining + credits,
  };
}

// Atomic increment of today's grade count; returns today's new count.
export async function incrementGrade(userId: string): Promise<number> {
  const { data, error } = await getServiceClient().rpc("increment_grade", {
    p_user: userId,
  });
  if (error) throw error;
  return typeof data === "number" ? data : 0;
}

// Atomically consume one purchased grade credit. Returns the remaining balance,
// or -1 when there was no credit to spend.
export async function consumeGradeCredit(userId: string): Promise<number> {
  const { data, error } = await getServiceClient().rpc("consume_grade_credit", {
    p_user: userId,
  });
  if (error) throw error;
  return typeof data === "number" ? data : -1;
}
