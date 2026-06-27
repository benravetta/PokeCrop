import type { GradeQuota, MeResponse } from "./api";

const DEFAULT_DAILY_CROP_LIMIT = 3;

export type CropUsageSnapshot = {
  limit: number;
  used: number;
  remaining: number;
  unlimited: boolean;
};

export type GradeUsageSnapshot = {
  limit: number;
  used: number;
  allowanceRemaining: number;
  remaining: number;
  credits: number;
  window: "day" | "month";
};

export function cropUsageFromMe(me: MeResponse | null): CropUsageSnapshot | null {
  if (!me || me.isAdmin) return null;
  if (me.plan !== "free") {
    return { limit: 0, used: 0, remaining: 0, unlimited: true };
  }
  const limit = me.dailyLimit ?? DEFAULT_DAILY_CROP_LIMIT;
  const remaining = Math.max(0, me.cropsRemaining ?? 0);
  const used = Math.max(0, limit - remaining);
  return { limit, used, remaining, unlimited: false };
}

export function gradeUsageFromMe(me: MeResponse | null): GradeUsageSnapshot | null {
  if (!me || me.isAdmin) return null;
  if (me.gradeLimit == null || me.gradeAllowanceRemaining == null) return null;
  return {
    limit: me.gradeLimit,
    used: me.gradeUsed ?? Math.max(0, me.gradeLimit - me.gradeAllowanceRemaining),
    allowanceRemaining: me.gradeAllowanceRemaining,
    remaining: me.gradeRemaining ?? me.gradeAllowanceRemaining + (me.gradeCredits ?? 0),
    credits: me.gradeCredits ?? 0,
    window: me.gradeWindow ?? "month",
  };
}

export function gradeUsageFromQuota(quota: GradeQuota): GradeUsageSnapshot {
  return {
    limit: quota.limit,
    used: quota.used,
    allowanceRemaining: quota.allowanceRemaining,
    remaining: quota.remaining,
    credits: quota.credits,
    window: quota.window,
  };
}

export function cropUsageHeadline(usage: CropUsageSnapshot): string {
  if (usage.unlimited) return "Unlimited crops";
  return `${usage.remaining} of ${usage.limit} left today`;
}

export function cropUsageDetail(usage: CropUsageSnapshot): string {
  if (usage.unlimited) return "Included on your plan";
  if (usage.used === 0) return "Daily allowance · resets at midnight UTC";
  return `${usage.used} used today · daily allowance · resets at midnight UTC`;
}

export function gradeUsageHeadline(usage: GradeUsageSnapshot): string {
  return `${usage.allowanceRemaining} of ${usage.limit} left ${
    usage.window === "month" ? "this month" : "today"
  }`;
}

export function gradeUsageDetail(usage: GradeUsageSnapshot): string {
  const period = usage.window === "month" ? "Monthly allowance · not daily" : "Daily allowance";
  const used =
    usage.used > 0
      ? `${usage.used} used ${usage.window === "month" ? "this month" : "today"}`
      : `None used ${usage.window === "month" ? "this month yet" : "today yet"}`;
  const credits =
    usage.credits > 0 ? ` · +${usage.credits} purchased credit${usage.credits === 1 ? "" : "s"}` : "";
  return `${used} · ${period}${credits}`;
}
