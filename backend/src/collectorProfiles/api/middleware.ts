import type { Request, Response, NextFunction } from "express";
import { isAdminRole } from "../../lib/adminAccess.js";
import { isCollectorProfilesEnvEnabled } from "../domain/featureFlag.js";
import { CollectorProfileError } from "../domain/types.js";
import {
  getCollectorProfileSettings,
  getStaffPermissions,
  isCollectorProfilesFeatureEnabled,
} from "../infrastructure/settingsRepo.js";
import { hasCollectorPermission, type CollectorPermission } from "../permissions/index.js";

export function sendCollectorProfileError(res: Response, err: unknown): void {
  if (err instanceof CollectorProfileError) {
    res.status(err.status).json({ error: err.message, error_code: err.code });
    return;
  }
  console.error("[collectorProfiles]", err);
  res.status(500).json({ error: "Something went wrong.", error_code: "internal_error" });
}

export async function requireCollectorProfilesEnabled(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!isCollectorProfilesEnvEnabled()) {
    res.status(404).json({ error: "Not found." });
    return;
  }
  try {
    if (!(await isCollectorProfilesFeatureEnabled())) {
      res.status(404).json({ error: "Not found." });
      return;
    }
    next();
  } catch (err) {
    sendCollectorProfileError(res, err);
  }
}

/** Admin routes: env gate only — DB records remain when feature disabled for customers. */
export async function requireCollectorProfilesAdminEnv(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!isCollectorProfilesEnvEnabled()) {
    res.status(404).json({ error: "Not found." });
    return;
  }
  next();
}

export async function requireCollectorMessagingEnabled(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const settings = await getCollectorProfileSettings();
    if (!settings.collector_profile_messaging_enabled) {
      res.status(404).json({ error: "Not found." });
      return;
    }
    next();
  } catch (err) {
    sendCollectorProfileError(res, err);
  }
}

export async function requireCollectorGradingEnabled(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const settings = await getCollectorProfileSettings();
    if (!settings.collector_profile_grading_enabled) {
      res.status(404).json({ error: "Not found." });
      return;
    }
    next();
  } catch (err) {
    sendCollectorProfileError(res, err);
  }
}

export async function requireCollectorTradeEnabled(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const settings = await getCollectorProfileSettings();
    if (!settings.collector_profile_trade_enquiries_enabled) {
      res.status(404).json({ error: "Not found." });
      return;
    }
    next();
  } catch (err) {
    sendCollectorProfileError(res, err);
  }
}

export function requireCollectorPermission(permission: CollectorPermission) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const isAdmin = isAdminRole(req.user?.role);
    if (isAdmin) {
      next();
      return;
    }
    try {
      const perms = await getStaffPermissions(req.user!.id);
      if (!hasCollectorPermission(perms, permission, false)) {
        res.status(403).json({ error: "Forbidden.", error_code: "COLLECTOR_FORBIDDEN" });
        return;
      }
      next();
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  };
}
