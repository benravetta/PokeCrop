const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function isTurnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

export async function verifyTurnstileToken(
  token: string | undefined,
  remoteIp?: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("TURNSTILE_SECRET_KEY is not set in production.");
      return { ok: false, message: "Security check is not configured." };
    }
    return { ok: true };
  }

  if (!token?.trim()) {
    return { ok: false, message: "Complete the security check." };
  }

  const body = new URLSearchParams({
    secret,
    response: token,
  });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await res.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };

    if (!data.success) {
      console.warn("Turnstile verification failed:", data["error-codes"]);
      return { ok: false, message: "Security check failed. Please try again." };
    }

    return { ok: true };
  } catch (err) {
    console.error("Turnstile siteverify error:", err);
    return { ok: false, message: "Could not verify security check." };
  }
}
