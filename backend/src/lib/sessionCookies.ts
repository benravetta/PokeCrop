import type { CookieOptions, Response } from "express";

export const ACCESS_COOKIE = "gc_access";
export const REFRESH_COOKIE = "gc_refresh";
export const CSRF_COOKIE = "gc_csrf";

const ACCESS_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour
const REFRESH_MAX_AGE_MS = 60 * 60 * 24 * 30 * 1000; // 30 days

function secureCookies(): boolean {
  return process.env.NODE_ENV === "production" || process.env.SESSION_COOKIE_SECURE === "1";
}

function baseCookieOptions(maxAgeMs: number): CookieOptions {
  return {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeMs,
  };
}

export function setSessionCookies(
  res: Response,
  accessToken: string,
  refreshToken: string
): void {
  res.cookie(ACCESS_COOKIE, accessToken, baseCookieOptions(ACCESS_MAX_AGE_MS));
  res.cookie(REFRESH_COOKIE, refreshToken, baseCookieOptions(REFRESH_MAX_AGE_MS));
}

export function clearSessionCookies(res: Response): void {
  const clearOpts: CookieOptions = {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  };
  res.cookie(ACCESS_COOKIE, "", clearOpts);
  res.cookie(REFRESH_COOKIE, "", clearOpts);
}

export function setCsrfCookie(res: Response, token: string): void {
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: secureCookies(),
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_MAX_AGE_MS,
  });
}

export function clearCsrfCookie(res: Response): void {
  res.cookie(CSRF_COOKIE, "", {
    httpOnly: false,
    secure: secureCookies(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
