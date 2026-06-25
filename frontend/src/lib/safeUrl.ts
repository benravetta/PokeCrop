const STRIPE_HOSTS = new Set(["checkout.stripe.com", "billing.stripe.com"]);

/** Allowlist Stripe checkout URLs before client-side navigation. */
export function safeStripeCheckoutUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    if (!STRIPE_HOSTS.has(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}
