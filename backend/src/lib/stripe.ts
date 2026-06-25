import Stripe from "stripe";
import { type SubscriptionPlan } from "./plans.js";

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

/** Premium (£9.99/mo) — internal plan id `unlimited`. */
export const PRICE_PREMIUM =
  process.env.STRIPE_PRICE_UNLIMITED || "price_1TldiFIXClJKdqLnZrYEHwrv";

/** Pro (£19.99/mo). */
export const PRICE_PRO =
  process.env.STRIPE_PRICE_PRO || "price_1TldjqIXClJKdqLnKCX3k5Xs";

/** Enterprise (Pro + REST API) — internal plan id `api`. */
export const PRICE_ENTERPRISE = process.env.STRIPE_PRICE_API || "";

export const PRICE_IDS: Record<SubscriptionPlan, string> = {
  unlimited: PRICE_PREMIUM,
  pro: PRICE_PRO,
  api: PRICE_ENTERPRISE,
};

// One-time (mode: "payment") price for buying a single grade without a
// subscription. Each purchase credits one grade to the buyer's account.
export const GRADE_SINGLE_PRICE = process.env.STRIPE_PRICE_GRADE_SINGLE || "";

export function isGradeSinglePriceConfigured(): boolean {
  return Boolean(GRADE_SINGLE_PRICE);
}

export const HUMAN_PREGRADE_PRICE = process.env.STRIPE_HUMAN_PREGRADE_PRICE || "";

export function isHumanPregradePriceConfigured(): boolean {
  return Boolean(HUMAN_PREGRADE_PRICE);
}

// Map a Stripe price id back to one of our plan tiers.
export function planForPrice(priceId: string | undefined | null): SubscriptionPlan | null {
  if (!priceId) return null;
  if (priceId === PRICE_IDS.unlimited) return "unlimited";
  if (priceId === PRICE_IDS.pro) return "pro";
  if (priceId === PRICE_IDS.api) return "api";
  return null;
}
