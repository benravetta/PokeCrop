import { HumanPregradeError } from "./types.js";

export const MAX_MESSAGE_BYTES = 4096;
export const MAX_TEXT_FIELD = 8192;
export const MAX_GEOMETRY_JSON = 16_384;

export function assertMaxLength(
  value: unknown,
  maxBytes: number,
  fieldLabel: string
): string | null {
  if (value == null || value === "") return null;
  const s = String(value);
  if (Buffer.byteLength(s, "utf8") > maxBytes) {
    throw new HumanPregradeError(
      "HUMAN_PREGRADE_INVALID_INPUT",
      `${fieldLabel} exceeds maximum length`,
      400
    );
  }
  return s;
}

export function assertMaxJsonSize(
  value: unknown,
  maxBytes: number,
  fieldLabel: string
): Record<string, unknown> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized, "utf8") > maxBytes) {
    throw new HumanPregradeError(
      "HUMAN_PREGRADE_INVALID_INPUT",
      `${fieldLabel} exceeds maximum size`,
      400
    );
  }
  return value as Record<string, unknown>;
}
