import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_TTL_SEC = 900;

function secret(): string {
  const configured = process.env.COLLECTOR_DISPLAY_HMAC_SECRET?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("COLLECTOR_DISPLAY_HMAC_SECRET is required in production.");
  }
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    "dev-collector-display-secret"
  );
}

export function signDisplayToken(opts: {
  publicCardId: string;
  role: string;
  size: "display" | "thumb";
  expSec?: number;
}): { token: string; exp: number } {
  const exp = Math.floor(Date.now() / 1000) + (opts.expSec ?? DEFAULT_TTL_SEC);
  const payload = `${opts.publicCardId}:${opts.role}:${opts.size}:${exp}`;
  const token = createHmac("sha256", secret()).update(payload).digest("base64url");
  return { token, exp };
}

export function verifyDisplayToken(opts: {
  publicCardId: string;
  role: string;
  size: "display" | "thumb";
  token: string;
  exp: number;
}): boolean {
  if (!opts.token || !Number.isFinite(opts.exp)) return false;
  if (opts.exp < Math.floor(Date.now() / 1000)) return false;
  const payload = `${opts.publicCardId}:${opts.role}:${opts.size}:${opts.exp}`;
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  try {
    const a = Buffer.from(opts.token);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function displayPath(opts: {
  publicCardId: string;
  role: string;
  size: "display" | "thumb";
}): string {
  const { token, exp } = signDisplayToken(opts);
  return `/api/collector/display/${encodeURIComponent(opts.publicCardId)}/${encodeURIComponent(opts.role)}?size=${opts.size}&t=${encodeURIComponent(token)}&exp=${exp}`;
}
