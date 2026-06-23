/** Subscription tiers stored in `subscriptions.plan`. */
export type Plan = "free" | "unlimited" | "pro" | "api";

export type SubscriptionPlan = Exclude<Plan, "free">;

export const PLAN_LABELS: Record<Plan, string> = {
  free: "Free",
  unlimited: "Premium",
  pro: "Pro",
  api: "Enterprise",
};

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = ["unlimited", "pro", "api"];

export function hasUnlimitedCrops(plan: Plan): boolean {
  return plan !== "free";
}

export function hasApiAccess(plan: Plan): boolean {
  return plan === "api";
}

export function isSubscriptionPlan(value: string): value is SubscriptionPlan {
  return value === "unlimited" || value === "pro" || value === "api";
}
