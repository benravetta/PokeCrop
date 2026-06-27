const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

export function sanitizeExternalUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (!ALLOWED_PROTOCOLS.has(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function sanitizeBio(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().slice(0, 500);
  return trimmed || null;
}
