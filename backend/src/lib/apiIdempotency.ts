/** Normalise caller-provided idempotency keys for grade requests. */
export function normalizeIdempotencyKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const key = raw.trim();
  if (key.length < 8 || key.length > 128) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(key)) return null;
  return key;
}
