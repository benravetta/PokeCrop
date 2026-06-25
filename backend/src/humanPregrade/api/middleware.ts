import type { Request, Response, NextFunction } from "express";
import { isAdminRole } from "../../lib/adminAccess.js";
import { isHumanPregradeEnvEnabled } from "../domain/featureFlag.js";
import { HumanPregradeError } from "../domain/types.js";
import { isHumanPregradeFeatureEnabled } from "../infrastructure/settingsRepo.js";
import { getStaffPermissions } from "../infrastructure/auditRepo.js";
import {
  hasHumanPregradePermission,
  type HumanPregradePermission,
} from "../permissions/index.js";

export function sendHumanPregradeError(res: Response, err: unknown): void {
  if (err instanceof HumanPregradeError) {
    res.status(err.status).json({ error: err.message, error_code: err.code });
    return;
  }
  console.error("[humanPregrade]", err);
  res.status(500).json({ error: "Something went wrong.", error_code: "internal_error" });
}

export async function requireHumanPregradeEnabled(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!isHumanPregradeEnvEnabled()) {
    res.status(404).json({ error: "Not found." });
    return;
  }
  const isAdmin = isAdminRole(req.user?.role);
  if (isAdmin) {
    next();
    return;
  }
  try {
    const enabled = await isHumanPregradeFeatureEnabled();
    if (!enabled) {
      res.status(404).json({ error: "Not found." });
      return;
    }
    next();
  } catch (err) {
    sendHumanPregradeError(res, err);
  }
}

export function requireHumanPregradePermission(permission: HumanPregradePermission) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized." });
      return;
    }
    const isAdmin = isAdminRole(req.user?.role);
    const staffPerms = isAdmin ? null : await getStaffPermissions(userId);
    if (!hasHumanPregradePermission(staffPerms, permission, isAdmin)) {
      res.status(403).json({
        error: "Forbidden.",
        error_code: "HUMAN_PREGRADE_FORBIDDEN",
      });
      return;
    }
    next();
  };
}

export async function getUserPermissions(userId: string, isAdmin: boolean): Promise<string[]> {
  if (isAdmin) return ["*"];
  return getStaffPermissions(userId);
}
