import { describe, expect, it } from "vitest";

describe("assertProductionEnv", () => {
  it("throws when CSRF_SECRET is missing in production", async () => {
    const prevNode = process.env.NODE_ENV;
    const prevCsrf = process.env.CSRF_SECRET;
    const prevOrigin = process.env.PUBLIC_ORIGIN;
    const prevTurnstile = process.env.TURNSTILE_SECRET_KEY;
    const prevCors = process.env.CORS_ORIGIN;
    process.env.NODE_ENV = "production";
    delete process.env.CSRF_SECRET;
    process.env.PUBLIC_ORIGIN = "https://example.com";
    process.env.TURNSTILE_SECRET_KEY = "secret";
    process.env.CORS_ORIGIN = "https://example.com";
    process.env.RATE_LIMIT_STORE = "postgres";

    const { assertProductionEnv } = await import("./envGuard.js");
    expect(() => assertProductionEnv()).toThrow(/CSRF_SECRET/);

    process.env.NODE_ENV = prevNode;
    if (prevCsrf) process.env.CSRF_SECRET = prevCsrf;
    else delete process.env.CSRF_SECRET;
    if (prevOrigin) process.env.PUBLIC_ORIGIN = prevOrigin;
    else delete process.env.PUBLIC_ORIGIN;
    if (prevTurnstile) process.env.TURNSTILE_SECRET_KEY = prevTurnstile;
    else delete process.env.TURNSTILE_SECRET_KEY;
    if (prevCors) process.env.CORS_ORIGIN = prevCors;
    else delete process.env.CORS_ORIGIN;
  });
});
