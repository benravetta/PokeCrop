import { getRateLimitStore, type RateLimitPeek } from "./rateLimitStore.js";

export const WINDOW_MS = 60_000;
export const DAY_MS = 86_400_000;

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const DAILY_SOFT_CAP = envInt("API_DAILY_SOFT_CAP", 5000);

export type ApiRateAction = "api:centering_preview" | "api:grade";

export type ApiRateBucket = "crop" | "straighten";
export type WebRateAction =
  | "web:crop_upload"
  | "web:crop_process"
  | "web:grade"
  | "web:grade_straighten"
  | "web:centering_preview";

function utcDay(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

function secondsToUtcMidnight(now: number): number {
  const d = new Date(now);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  return Math.ceil((next - now) / 1000);
}

function apiAction(bucket: ApiRateBucket): string {
  return bucket === "straighten" ? "api:straighten" : "api:crop";
}

function apiMinuteLimit(bucket: ApiRateBucket): number {
  return bucket === "straighten"
    ? envInt("API_STRAIGHTEN_RATE_PER_MIN", 30)
    : envInt("API_RATE_PER_MIN", 60);
}

function apiLimit(action: ApiRateAction): number {
  switch (action) {
    case "api:centering_preview":
      return envInt("API_CENTERING_PREVIEW_PER_MIN", 120);
    case "api:grade":
      return envInt("API_GRADE_PER_MIN", 6);
  }
}

function webLimit(action: WebRateAction): number {
  switch (action) {
    case "web:crop_upload":
      return envInt("WEB_CROP_UPLOAD_PER_MIN", 20);
    case "web:crop_process":
      return envInt("WEB_CROP_PROCESS_PER_MIN", 40);
    case "web:grade":
      return envInt("WEB_GRADE_PER_MIN", 6);
    case "web:grade_straighten":
      return envInt("WEB_GRADE_STRAIGHTEN_PER_MIN", 30);
    case "web:centering_preview":
      return envInt("WEB_CENTERING_PREVIEW_PER_MIN", 120);
  }
}

export interface RateResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
  retryAfterSec: number;
  reason?: "minute" | "daily";
  message?: string;
}

function toRateResult(peek: RateLimitPeek, reason?: RateResult["reason"]): RateResult {
  return {
    allowed: peek.allowed,
    limit: peek.limit,
    remaining: Math.max(0, peek.limit - peek.count),
    resetMs: peek.resetMs,
    retryAfterSec: peek.retryAfterSec,
    reason,
    message: reason === "daily"
      ? "Daily request cap reached. Contact support to raise your limit."
      : reason === "minute"
        ? "Rate limit exceeded. Slow down."
        : undefined,
  };
}

async function peekAction(
  accountId: string,
  action: string,
  limit: number,
  windowMs: number
): Promise<RateResult> {
  const peek = await getRateLimitStore().peek(accountId, action, windowMs, limit);
  return toRateResult(peek, peek.allowed ? undefined : "minute");
}

/** API crop/straighten: peek minute + daily crop cap without consuming. */
export async function peekApiRateLimit(
  accountId: string,
  bucket: ApiRateBucket = "crop"
): Promise<RateResult> {
  const minute = await peekAction(accountId, apiAction(bucket), apiMinuteLimit(bucket), WINDOW_MS);
  if (!minute.allowed) return minute;

  if (bucket !== "crop") return minute;

  const daily = await peekAction(
    accountId,
    `api:crop-day:${utcDay()}`,
    DAILY_SOFT_CAP,
    DAY_MS
  );
  if (!daily.allowed) {
    return {
      ...daily,
      reason: "daily",
      message: "Daily request cap reached. Contact support to raise your limit.",
      retryAfterSec: secondsToUtcMidnight(Date.now()),
    };
  }
  return minute;
}

/** API crop/straighten: consume after successful work. */
export async function consumeApiRateLimit(
  accountId: string,
  bucket: ApiRateBucket = "crop"
): Promise<void> {
  await getRateLimitStore().consume(
    accountId,
    apiAction(bucket),
    WINDOW_MS,
    apiMinuteLimit(bucket)
  );
  if (bucket === "crop") {
    await getRateLimitStore().consume(
      accountId,
      `api:crop-day:${utcDay()}`,
      DAY_MS,
      DAILY_SOFT_CAP
    );
  }
}

/** Web authenticated routes: peek without consuming (call consumeWebRateLimitSlot on success). */
export async function peekWebRateLimit(
  accountId: string,
  action: WebRateAction
): Promise<RateResult> {
  return peekAction(accountId, action, webLimit(action), WINDOW_MS);
}

/** Consume one web rate-limit slot after successful work. */
export async function consumeWebRateLimitSlot(
  accountId: string,
  action: WebRateAction
): Promise<void> {
  await getRateLimitStore().consume(accountId, action, WINDOW_MS, webLimit(action));
}

/** API key routes: peek without consuming. */
export async function peekApiActionRateLimit(
  accountId: string,
  action: ApiRateAction
): Promise<RateResult> {
  return peekAction(accountId, action, apiLimit(action), WINDOW_MS);
}

/** Consume one API action slot after successful work. */
export async function consumeApiActionRateLimitSlot(
  accountId: string,
  action: ApiRateAction
): Promise<void> {
  await getRateLimitStore().consume(accountId, action, WINDOW_MS, apiLimit(action));
}

/** @deprecated Prefer peekWebRateLimit + consumeWebRateLimitSlot */
export async function consumeWebRateLimit(
  accountId: string,
  action: WebRateAction
): Promise<RateResult> {
  return consumeAccountRateLimit(accountId, action, webLimit(action));
}

/** @deprecated Prefer peekApiActionRateLimit + consumeApiActionRateLimitSlot */
export async function consumeApiActionRateLimit(
  accountId: string,
  action: ApiRateAction
): Promise<RateResult> {
  return consumeAccountRateLimit(accountId, action, apiLimit(action));
}

async function consumeAccountRateLimit(
  accountId: string,
  action: string,
  limit: number
): Promise<RateResult> {
  const consumed = await getRateLimitStore().consume(accountId, action, WINDOW_MS, limit);
  const peek = await getRateLimitStore().peek(accountId, action, WINDOW_MS, limit);
  if (!consumed) {
    return toRateResult({ ...peek, allowed: false }, "minute");
  }
  return toRateResult({ ...peek, allowed: true });
}

export function rateLimitHeaders(r: RateResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(r.limit),
    "X-RateLimit-Remaining": String(r.remaining),
    "X-RateLimit-Reset": String(Math.floor(r.resetMs / 1000)),
  };
}
