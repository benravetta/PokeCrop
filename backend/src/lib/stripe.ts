import Stripe from "stripe";

const KEY = process.env.STRIPE_SECRET_KEY || "";

let client: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return Boolean(KEY);
}

export function getStripe(): Stripe {
  if (!KEY) {
    throw new Error("Stripe is not configured (set STRIPE_SECRET_KEY).");
  }
  if (!client) {
    client = new Stripe(KEY);
  }
  return client;
}

export const PRICE_IDS: Record<"unlimited" | "api", string> = {
  unlimited: process.env.STRIPE_PRICE_UNLIMITED || "",
  api: process.env.STRIPE_PRICE_API || "",
};

// Map a Stripe price id back to one of our plan tiers.
export function planForPrice(
  priceId: string | undefined | null
): "unlimited" | "api" | null {
  if (!priceId) return null;
  if (priceId === PRICE_IDS.unlimited) return "unlimited";
  if (priceId === PRICE_IDS.api) return "api";
  return null;
}
