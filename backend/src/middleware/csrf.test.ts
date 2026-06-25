import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { issueCsrfToken, verifyCsrfToken, csrfProtection } from "./csrf.js";
import { CSRF_COOKIE } from "../lib/sessionCookies.js";

function runCsrf(
  opts: {
    method?: string;
    path?: string;
    csrfHeader?: string;
    cookie?: string;
  } = {}
): { status?: number; body?: unknown; nextCalled: boolean } {
  let status: number | undefined;
  let body: unknown;
  let nextCalled = false;

  const req = {
    method: opts.method ?? "POST",
    path: opts.path ?? "/protected",
    get: (name: string) => (name === "X-CSRF-Token" ? opts.csrfHeader ?? "" : undefined),
    cookies: opts.cookie ? { [CSRF_COOKIE]: opts.cookie } : {},
  } as unknown as Request;

  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    json(payload: unknown) {
      body = payload;
      return this;
    },
  } as unknown as Response;

  const next: NextFunction = () => {
    nextCalled = true;
  };

  csrfProtection(req, res, next);
  return { status, body, nextCalled };
}

describe("csrfProtection", () => {
  it("issues verifiable tokens", () => {
    const token = issueCsrfToken();
    expect(verifyCsrfToken(token)).toBe(true);
    expect(verifyCsrfToken("bad.token")).toBe(false);
  });

  it("blocks mutating requests without a matching CSRF token", () => {
    const token = issueCsrfToken();
    const missing = runCsrf();
    expect(missing.nextCalled).toBe(false);
    expect(missing.status).toBe(403);

    const mismatch = runCsrf({ cookie: token, csrfHeader: issueCsrfToken() });
    expect(mismatch.status).toBe(403);
  });

  it("allows mutating requests when header matches cookie", () => {
    const token = issueCsrfToken();
    const ok = runCsrf({ cookie: token, csrfHeader: token });
    expect(ok.nextCalled).toBe(true);
    expect(ok.status).toBeUndefined();
  });

  it("skips CSRF for auth bootstrap routes", () => {
    const login = runCsrf({ path: "/auth/login" });
    expect(login.nextCalled).toBe(true);

    const reset = runCsrf({ path: "/auth/password-reset" });
    expect(reset.nextCalled).toBe(true);
  });

  it("skips GET requests", () => {
    const get = runCsrf({ method: "GET" });
    expect(get.nextCalled).toBe(true);
  });
});
