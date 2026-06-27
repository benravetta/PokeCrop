import { Request, Response, NextFunction } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { getServiceClient, isSupabaseConfigured } from "../lib/supabase.js";
import { ACCESS_COOKIE } from "../lib/sessionCookies.js";
import { checkAdminRateLimit } from "./adminRateLimit.js";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const ISSUER = SUPABASE_URL ? `${SUPABASE_URL}/auth/v1` : "";

// New Supabase projects sign JWTs with asymmetric keys (ECC/RSA), so we can
// verify access tokens locally against the project's JWKS endpoint — fast and
// no network round-trip per request. If local verification fails (e.g. a
// project still on symmetric HS256 keys) we fall back to the Auth server.
const jwks =
  SUPABASE_URL && typeof URL !== "undefined"
    ? createRemoteJWKSet(
        new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`)
      )
    : null;

export interface AuthUser {
  id: string;
  email?: string;
  role: "user" | "admin";
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function extractToken(req: Request): string | null {
  const fromCookie = req.cookies?.[ACCESS_COOKIE];
  if (typeof fromCookie === "string" && fromCookie.trim()) {
    return fromCookie.trim();
  }
  return null;
}

export function roleFromAppMetadata(appMetadata: unknown): "user" | "admin" {
  if (appMetadata && typeof appMetadata === "object") {
    const role = (appMetadata as Record<string, unknown>).role;
    if (role === "admin") return "admin";
  }
  return "user";
}

function isBanned(bannedUntil: string | null | undefined): boolean {
  return Boolean(bannedUntil && new Date(bannedUntil) > new Date());
}

async function resolveUser(token: string): Promise<AuthUser | null> {
  // Primary path: local JWKS verification.
  if (jwks) {
    try {
      const { payload } = await jwtVerify(token, jwks, {
        issuer: ISSUER,
        audience: "authenticated",
      });
      if (payload.sub) {
        return {
          id: payload.sub,
          email: typeof payload.email === "string" ? payload.email : undefined,
          role: roleFromAppMetadata(payload.app_metadata),
        };
      }
    } catch {
      // Fall through to the network verification path below.
    }
  }

  // Fallback: ask the Auth server to validate the token.
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await getServiceClient().auth.getUser(token);
      if (!error && data.user) {
        return {
          id: data.user.id,
          email: data.user.email ?? undefined,
          role: roleFromAppMetadata(data.user.app_metadata),
        };
      }
    } catch {
      // Ignore — treated as unauthenticated below.
    }
  }

  return null;
}

/** Re-fetch role and ban state from Auth — JWT app_metadata can be stale. */
async function refreshLiveUser(req: Request, res: Response): Promise<boolean> {
  if (!req.user) return false;
  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: "Authentication is not configured." });
    return false;
  }
  try {
    const { data, error } = await getServiceClient().auth.admin.getUserById(req.user.id);
    if (error || !data.user) {
      res.status(401).json({ error: "Invalid or expired session." });
      return false;
    }
    const bannedUntil = (data.user as unknown as { banned_until?: string | null })
      .banned_until;
    if (isBanned(bannedUntil)) {
      res.status(403).json({ error: "This account is suspended." });
      return false;
    }
    req.user.role = roleFromAppMetadata(data.user.app_metadata);
    if (data.user.email) req.user.email = data.user.email;
    return true;
  } catch {
    res.status(503).json({ error: "Could not verify account." });
    return false;
  }
}

/** Sets req.user when a valid session cookie is present; never rejects. */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractToken(req);
  if (token) {
    const user = await resolveUser(token);
    if (user) req.user = user;
  }
  next();
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: "Authentication is not configured." });
    return;
  }
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  const user = await resolveUser(token);
  if (!user) {
    res.status(401).json({ error: "Invalid or expired session." });
    return;
  }
  req.user = user;
  next();
}

/** Authenticated web/API session with live role + suspension checks. */
export async function requireActiveAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  await requireAuth(req, res, async () => {
    if (!(await refreshLiveUser(req, res))) return;
    next();
  });
}

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  await requireAuth(req, res, async () => {
    if (!(await refreshLiveUser(req, res))) return;
    if (req.user?.role !== "admin") {
      res.status(403).json({ error: "Admin access required." });
      return;
    }
    if (!checkAdminRateLimit(req.user.id, res)) return;
    next();
  });
}

export async function requireAdminMutating(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  await requireAuth(req, res, async () => {
    if (!(await refreshLiveUser(req, res))) return;
    if (req.user?.role !== "admin") {
      res.status(403).json({ error: "Admin access required." });
      return;
    }
    if (!checkAdminRateLimit(req.user.id, res, { mutating: true })) return;
    next();
  });
}
