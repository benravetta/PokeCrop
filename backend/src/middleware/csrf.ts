import type { Request, Response, NextFunction } from "express";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { CSRF_COOKIE } from "../lib/sessionCookies.js";

const DEFAULT_CSRF = "dev-csrf-secret-change-in-production";
const CSRF_SECRET = process.env.CSRF_SECRET || DEFAULT_CSRF;

if (process.env.NODE_ENV === "production" && CSRF_SECRET === DEFAULT_CSRF) {
  throw new Error("CSRF_SECRET must be set to a strong random value in production.");
}

function signToken(raw: string): string {
  return createHmac("sha256", CSRF_SECRET).update(raw).digest("hex");
}

export function issueCsrfToken(): string {
  const raw = randomBytes(32).toString("hex");
  return `${raw}.${signToken(raw)}`;
}

export function verifyCsrfToken(token: string): boolean {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;
  const raw = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = signToken(raw);
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (!MUTATING.has(req.method)) {
    next();
    return;
  }
  if (req.path.startsWith("/webhooks/")) {
    next();
    return;
  }
  if (
    req.path.startsWith("/auth/login") ||
    req.path.startsWith("/auth/signup") ||
    req.path.startsWith("/auth/password-reset") ||
    req.path.startsWith("/auth/exchange") ||
    req.path.startsWith("/auth/invite/validate")
  ) {
    next();
    return;
  }

  const header = req.get("X-CSRF-Token") ?? "";
  const cookie = req.cookies?.[CSRF_COOKIE] ?? "";
  if (!header || !cookie || header !== cookie || !verifyCsrfToken(String(header))) {
    res.status(403).json({ error: "Invalid CSRF token." });
    return;
  }
  next();
}
