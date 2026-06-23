import { Request, Response, NextFunction } from "express";
import { isSupabaseConfigured } from "../lib/supabase.js";
import { resolveApiKey, touchLastUsed } from "../lib/apiKeys.js";
import { getPlan, isSuspended } from "../lib/usage.js";
import { sendApiError } from "../lib/apiError.js";

export interface ApiCaller {
  keyId: string;
  userId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      apiUser?: ApiCaller;
    }
  }
}

function extractKey(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    return header.slice("Bearer ".length).trim();
  }
  // Convenience: also accept the dedicated X-API-Key header.
  const alt = req.headers["x-api-key"];
  if (typeof alt === "string" && alt.trim()) return alt.trim();
  return null;
}

// Authenticate a request with a GemCheck API key and require an active "api"
// plan. Attaches req.apiUser on success.
export async function requireApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!isSupabaseConfigured()) {
    sendApiError(res, "not_configured", "API is not configured.");
    return;
  }

  const key = extractKey(req);
  if (!key) {
    sendApiError(
      res,
      "unauthorized",
      "Missing API key. Send it as 'Authorization: Bearer <key>'."
    );
    return;
  }

  let caller: ApiCaller | null;
  try {
    caller = await resolveApiKey(key);
  } catch (err) {
    console.error("API key lookup failed:", err);
    sendApiError(res, "internal_error", "Could not verify API key.");
    return;
  }

  if (!caller) {
    sendApiError(res, "unauthorized", "Invalid or revoked API key.");
    return;
  }

  let plan: string;
  let suspended: boolean;
  try {
    [plan, suspended] = await Promise.all([
      getPlan(caller.userId),
      isSuspended(caller.userId),
    ]);
  } catch (err) {
    console.error("API plan check failed:", err);
    sendApiError(res, "not_configured", "Could not verify your plan.");
    return;
  }

  if (suspended) {
    sendApiError(res, "forbidden_plan", "This account is suspended.");
    return;
  }

  if (plan !== "api") {
    sendApiError(
      res,
      "forbidden_plan",
      "API access requires the API plan. Upgrade at /pricing."
    );
    return;
  }

  touchLastUsed(caller.keyId);
  req.apiUser = caller;
  next();
}
