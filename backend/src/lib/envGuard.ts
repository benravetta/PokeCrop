const DEFAULT_CSRF = "dev-csrf-secret-change-in-production";

/** Fail fast in production when required secrets/origins are missing. */
export function assertProductionEnv(): void {
  if (process.env.NODE_ENV !== "production") return;

  const csrf = process.env.CSRF_SECRET?.trim();
  if (!csrf || csrf === DEFAULT_CSRF) {
    throw new Error("CSRF_SECRET must be set to a strong random value in production.");
  }

  const origin = process.env.PUBLIC_ORIGIN?.trim();
  if (!origin) {
    throw new Error("PUBLIC_ORIGIN must be set in production (used for Stripe redirects).");
  }

  if (!process.env.TURNSTILE_SECRET_KEY?.trim()) {
    throw new Error("TURNSTILE_SECRET_KEY must be set in production (auth captcha).");
  }

  const rateStore = (
    process.env.RATE_LIMIT_STORE ||
    process.env.HUMAN_PREGRADE_RATE_LIMIT_STORE ||
    "postgres"
  ).toLowerCase();
  if (rateStore === "memory") {
    throw new Error("RATE_LIMIT_STORE=memory is not allowed in production.");
  }

  const cors = process.env.CORS_ORIGIN?.trim();
  if (!cors) {
    throw new Error("CORS_ORIGIN must be set to the production SPA origin.");
  }
}
