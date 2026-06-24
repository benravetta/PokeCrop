import type { Response } from "express";
import { getServiceClient } from "./supabase.js";
import type { Plan } from "./plans.js";
import type { GradeQuota } from "./gradeQuota.js";

export type UserRole = "user" | "admin";

export function roleFromAppMetadata(appMetadata: unknown): UserRole {
  if (appMetadata && typeof appMetadata === "object") {
    const role = (appMetadata as Record<string, unknown>).role;
    if (role === "admin") return "admin";
  }
  return "user";
}

export function isAdminRole(role: UserRole | undefined | null): boolean {
  return role === "admin";
}

/** Enterprise-level feature access for admin accounts. */
export const ADMIN_EFFECTIVE_PLAN: Plan = "api";

export function effectivePlan(plan: Plan, role: UserRole | undefined | null): Plan {
  return isAdminRole(role) ? ADMIN_EFFECTIVE_PLAN : plan;
}

export function adminGradeQuota(): GradeQuota {
  return {
    plan: ADMIN_EFFECTIVE_PLAN,
    limit: 0,
    used: 0,
    remaining: 999_999,
    window: "month",
    allowanceRemaining: 999_999,
    credits: 0,
    isAdmin: true,
  };
}

export async function getUserRole(userId: string): Promise<UserRole> {
  try {
    const { data, error } = await getServiceClient().auth.admin.getUserById(userId);
    if (error || !data?.user) return "user";
    return roleFromAppMetadata(data.user.app_metadata);
  } catch (err) {
    console.error("getUserRole failed:", err);
    return "user";
  }
}

export function rejectAdminBilling(
  role: UserRole | undefined | null,
  res: Response
): boolean {
  if (!isAdminRole(role)) return false;
  res.status(403).json({
    error: "Admin accounts have full access and cannot purchase or change plans.",
  });
  return true;
}
