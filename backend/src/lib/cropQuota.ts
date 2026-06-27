import { isAdminRole, type UserRole } from "./adminAccess.js";
import {
  FREE_DAILY_LIMIT,
  decrementUsage,
  getPlan,
  getUsageToday,
  incrementUsage,
  isUnlimited,
  type Plan,
} from "./usage.js";
import { logUsageEvent, type UsageBilling } from "./usageEvents.js";

export class CropQuotaExceededError extends Error {
  readonly status = 402;
  readonly code = "crop_quota_exceeded";
  constructor(
    readonly plan: Plan,
    readonly limit: number,
    readonly remaining: number
  ) {
    super(`You've used all ${limit} free crops today. Upgrade for unlimited crops.`);
    this.name = "CropQuotaExceededError";
  }
}

export async function assertCropQuota(
  userId: string,
  role?: UserRole | null
): Promise<{ plan: Plan; unlimited: boolean; remaining: number | null; limit: number | null }> {
  if (isAdminRole(role)) {
    return { plan: "free", unlimited: true, remaining: null, limit: null };
  }
  const plan = await getPlan(userId);
  if (isUnlimited(plan)) {
    return { plan, unlimited: true, remaining: null, limit: null };
  }
  const used = await getUsageToday(userId);
  if (used >= FREE_DAILY_LIMIT) {
    throw new CropQuotaExceededError(plan, FREE_DAILY_LIMIT, 0);
  }
  return {
    plan,
    unlimited: false,
    remaining: Math.max(0, FREE_DAILY_LIMIT - used),
    limit: FREE_DAILY_LIMIT,
  };
}

/** Atomically increment daily crop count; throws if free limit exceeded. */
export async function reserveCropQuota(opts: {
  userId: string;
  role?: UserRole | null;
}): Promise<{
  usedAfter: number;
  remainingAfter: number | null;
  billing: UsageBilling;
  plan: Plan;
  incremented: boolean;
}> {
  if (isAdminRole(opts.role)) {
    return { usedAfter: 0, remainingAfter: null, billing: "admin", plan: "free", incremented: false };
  }
  const plan = await getPlan(opts.userId);
  const billing: UsageBilling = plan === "free" ? "free" : "subscription";
  if (isUnlimited(plan)) {
    return { usedAfter: 0, remainingAfter: null, billing, plan, incremented: false };
  }
  const usedAfter = await incrementUsage(opts.userId);
  if (usedAfter > FREE_DAILY_LIMIT) {
    await decrementUsage(opts.userId);
    throw new CropQuotaExceededError(plan, FREE_DAILY_LIMIT, 0);
  }
  const remainingAfter = Math.max(0, FREE_DAILY_LIMIT - usedAfter);
  return { usedAfter, remainingAfter, billing, plan, incremented: true };
}

/** Undo a reserved crop slot when confirm fails before completion. */
export async function releaseCropQuota(userId: string): Promise<void> {
  await decrementUsage(userId);
}

export async function meterCropUsage(opts: {
  userId: string;
  role?: UserRole | null;
  summary?: string | null;
  detail?: Record<string, unknown> | null;
  reserved?: {
    usedAfter: number;
    remainingAfter: number | null;
    billing: UsageBilling;
    plan: Plan;
    incremented: boolean;
  };
}): Promise<{ usedAfter: number; remainingAfter: number | null; billing: UsageBilling }> {
  if (isAdminRole(opts.role)) {
    return { usedAfter: 0, remainingAfter: null, billing: "admin" };
  }

  let usedAfter: number;
  let remainingAfter: number | null;
  let billing: UsageBilling;
  let plan: Plan;

  if (opts.reserved) {
    usedAfter = opts.reserved.usedAfter;
    remainingAfter = opts.reserved.remainingAfter;
    billing = opts.reserved.billing;
    plan = opts.reserved.plan;
  } else {
    const reserved = await reserveCropQuota({ userId: opts.userId, role: opts.role });
    usedAfter = reserved.usedAfter;
    remainingAfter = reserved.remainingAfter;
    billing = reserved.billing;
    plan = reserved.plan;
  }

  if (isUnlimited(plan)) {
    logUsageEvent({
      userId: opts.userId,
      kind: "crop",
      source: "web",
      billing,
      plan,
      window: "day",
      summary: opts.summary ?? null,
      detail: { ...(opts.detail ?? {}), collector_profile: true },
    });
    return { usedAfter: 0, remainingAfter: null, billing };
  }

  logUsageEvent({
    userId: opts.userId,
    kind: "crop",
    source: "web",
    billing,
    plan,
    window: "day",
    usedAfter,
    remainingAfter,
    summary: opts.summary ?? null,
    detail: { ...(opts.detail ?? {}), collector_profile: true },
  });
  return { usedAfter, remainingAfter, billing };
}
