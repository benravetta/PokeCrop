import { Response } from "express";

// Stable, machine-friendly error codes for the public /v1 API. The web app
// uses a different (string `error`) shape; API clients get a structured
// envelope: { error: { code, message } }.
export type ApiErrorCode =
  | "unauthorized"
  | "forbidden_plan"
  | "rate_limited"
  | "quota_exceeded"
  | "capture_quality"
  | "invalid_request"
  | "not_found"
  | "unsupported_media_type"
  | "payload_too_large"
  | "unprocessable_image"
  | "processing_failed"
  | "not_configured"
  | "internal_error";

const STATUS_FOR_CODE: Record<ApiErrorCode, number> = {
  unauthorized: 401,
  forbidden_plan: 403,
  rate_limited: 429,
  quota_exceeded: 429,
  capture_quality: 422,
  invalid_request: 400,
  not_found: 404,
  unsupported_media_type: 415,
  payload_too_large: 413,
  unprocessable_image: 422,
  processing_failed: 502,
  not_configured: 503,
  internal_error: 500,
};

export function sendApiError(
  res: Response,
  code: ApiErrorCode | string,
  message: string,
  extraHeaders?: Record<string, string>,
  extraBody?: Record<string, unknown>
): void {
  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) res.set(k, v);
  }
  const status = STATUS_FOR_CODE[code as ApiErrorCode] ?? 400;
  res.status(status).json({ error: { code, message }, ...extraBody });
}
