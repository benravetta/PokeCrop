import { Request, Response, NextFunction } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { getServiceClient, isSupabaseConfigured } from "../lib/supabase.js";

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
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    return header.slice("Bearer ".length).trim();
  }
  return null;
}

function roleFromAppMetadata(appMetadata: unknown): "user" | "admin" {
  if (appMetadata && typeof appMetadata === "object") {
    const role = (appMetadata as Record<string, unknown>).role;
    if (role === "admin") return "admin";
  }
  return "user";
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

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  await requireAuth(req, res, () => {
    if (req.user?.role !== "admin") {
      res.status(403).json({ error: "Admin access required." });
      return;
    }
    next();
  });
}
