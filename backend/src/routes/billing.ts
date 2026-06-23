import { Router, Request, Response } from "express";
import type Stripe from "stripe";
import { requireAuth } from "../middleware/auth.js";
import { getServiceClient } from "../lib/supabase.js";
import { logActivity } from "../lib/activity.js";
import {
  getStripe,
  isStripeConfigured,
  isGradeSinglePriceConfigured,
  GRADE_SINGLE_PRICE,
  PRICE_IDS,
  planForPrice,
} from "../lib/stripe.js";

const router = Router();

function publicOrigin(req: Request): string {
  return (
    process.env.PUBLIC_ORIGIN ||
    `${req.protocol}://${req.get("host") ?? "localhost:8080"}`
  );
}

async function getOrCreateCustomer(
  userId: string,
  email: string | undefined
): Promise<string> {
  const sb = getServiceClient();
  const { data } = await sb
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (data?.stripe_customer_id) return data.stripe_customer_id;

  const customer = await getStripe().customers.create({
    email,
    metadata: { user_id: userId },
  });

  // Upsert (not update) so a missing subscriptions row can't silently drop the
  // customer id and cause a duplicate Stripe customer on the next checkout.
  const { error } = await sb
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        stripe_customer_id: customer.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
  if (error) console.error("Failed to persist Stripe customer id:", error);

  return customer.id;
}

// Start a Stripe Checkout session for a subscription plan.
router.post("/billing/checkout", requireAuth, async (req: Request, res: Response) => {
  if (!isStripeConfigured()) {
    res.status(503).json({ error: "Billing is not configured." });
    return;
  }
  const plan = req.body?.plan as "unlimited" | "api" | undefined;
  if (plan !== "unlimited" && plan !== "api") {
    res.status(400).json({ error: "Unknown plan." });
    return;
  }
  const priceId = PRICE_IDS[plan];
  if (!priceId) {
    res.status(503).json({ error: `Plan "${plan}" is not available yet.` });
    return;
  }

  try {
    const userId = req.user!.id;
    const customerId = await getOrCreateCustomer(userId, req.user!.email);
    const origin = publicOrigin(req);

    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: userId,
      subscription_data: { metadata: { user_id: userId } },
      allow_promotion_codes: true,
      success_url: `${origin}/account?checkout=success`,
      cancel_url: `${origin}/account?checkout=cancel`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Checkout creation failed:", err);
    res.status(500).json({ error: "Could not start checkout." });
  }
});

// Start a one-time Checkout session to buy a single grade (no subscription).
// On payment, the webhook credits one grade to the buyer's account.
router.post(
  "/billing/checkout-grade",
  requireAuth,
  async (req: Request, res: Response) => {
    if (!isStripeConfigured() || !isGradeSinglePriceConfigured()) {
      res.status(503).json({ error: "Single-grade purchases aren't available yet." });
      return;
    }
    try {
      const userId = req.user!.id;
      const customerId = await getOrCreateCustomer(userId, req.user!.email);
      const origin = publicOrigin(req);

      const session = await getStripe().checkout.sessions.create({
        mode: "payment",
        customer: customerId,
        line_items: [{ price: GRADE_SINGLE_PRICE, quantity: 1 }],
        client_reference_id: userId,
        // Metadata on the session and the resulting PaymentIntent so the webhook
        // can attribute and credit the purchase regardless of which it reads.
        metadata: { user_id: userId, product: "grade_single", qty: "1" },
        payment_intent_data: {
          metadata: { user_id: userId, product: "grade_single", qty: "1" },
        },
        allow_promotion_codes: true,
        success_url: `${origin}/grade?purchase=success`,
        cancel_url: `${origin}/grade?purchase=cancel`,
      });

      res.json({ url: session.url });
    } catch (err) {
      console.error("Grade checkout creation failed:", err);
      res.status(500).json({ error: "Could not start checkout." });
    }
  }
);

// Open the Stripe Customer Portal for managing/cancelling a subscription.
router.post("/billing/portal", requireAuth, async (req: Request, res: Response) => {
  if (!isStripeConfigured()) {
    res.status(503).json({ error: "Billing is not configured." });
    return;
  }
  try {
    const sb = getServiceClient();
    const { data } = await sb
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", req.user!.id)
      .maybeSingle();

    if (!data?.stripe_customer_id) {
      res.status(400).json({ error: "No billing account yet." });
      return;
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: data.stripe_customer_id,
      return_url: `${publicOrigin(req)}/account`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Portal creation failed:", err);
    res.status(500).json({ error: "Could not open billing portal." });
  }
});

// Reflect a Stripe subscription into our subscriptions table. getPlan() treats
// any non-active status as effectively free, so we store the purchased plan plus
// the live status.
async function syncSubscription(sub: Stripe.Subscription): Promise<void> {
  const sb = getServiceClient();
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  const { data: row } = await sb
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  const userId = row?.user_id ?? (sub.metadata?.user_id as string | undefined);
  if (!userId) {
    console.warn("Stripe subscription with no resolvable user:", sub.id);
    return;
  }

  const priceId = sub.items.data[0]?.price?.id;
  const plan = planForPrice(priceId) ?? "free";
  const periodEnd = (sub as unknown as { current_period_end?: number })
    .current_period_end;

  // Upsert keyed on user_id: idempotent, and resilient if the row is missing.
  const { error } = await sb.from("subscriptions").upsert(
    {
      user_id: userId,
      plan,
      status: sub.status,
      stripe_subscription_id: sub.id,
      stripe_customer_id: customerId,
      current_period_end: periodEnd
        ? new Date(periodEnd * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  // Surface failures so the webhook returns non-2xx and Stripe retries.
  if (error) throw error;

  // Audit the billing-driven plan/status change (actor = system/Stripe).
  logActivity({
    userId,
    action: "subscription.synced",
    detail: { plan, status: sub.status, source: "stripe" },
  });
}

// Credit purchased grade(s) from a completed one-time Checkout session.
async function creditGradePurchase(session: Stripe.Checkout.Session): Promise<void> {
  // Only one-time payments for the single-grade product.
  if (session.mode !== "payment") return;
  const meta = session.metadata ?? {};
  if (meta.product !== "grade_single") return;
  // Don't credit until the money is actually captured.
  if (session.payment_status !== "paid") return;

  const userId = (meta.user_id as string | undefined) || session.client_reference_id || undefined;
  if (!userId) {
    console.warn("grade purchase with no resolvable user:", session.id);
    return;
  }
  const qty = Math.max(1, parseInt((meta.qty as string) || "1", 10) || 1);

  const sb = getServiceClient();
  const { error } = await sb.rpc("add_grade_credits", { p_user: userId, p_qty: qty });
  if (error) throw error;

  logActivity({
    userId,
    action: "grade.credit.purchased",
    detail: { qty, source: "stripe", session: session.id },
  });
}

// Record a Stripe event id so retries / at-least-once delivery never double-apply.
// Returns true if this is the first time we've seen the event (caller should
// process it), false if it was already processed.
async function claimStripeEvent(event: Stripe.Event): Promise<boolean> {
  const sb = getServiceClient();
  const { error } = await sb
    .from("stripe_events")
    .insert({ id: event.id, type: event.type });
  if (error) {
    // Unique-violation => already processed. Anything else: rethrow so Stripe
    // retries rather than silently dropping the event.
    if ((error as { code?: string }).code === "23505") return false;
    throw error;
  }
  return true;
}

// Release a claimed event id so a Stripe retry can reprocess it. Used when
// processing fails after the claim, otherwise the retry would be deduped away
// and the side effect (e.g. crediting a grade) lost.
async function releaseStripeEvent(eventId: string): Promise<void> {
  try {
    await getServiceClient().from("stripe_events").delete().eq("id", eventId);
  } catch (err) {
    console.error("Failed to release Stripe event claim:", err);
  }
}

// Stripe webhook. Mounted with a raw body parser (see index.ts) so the
// signature can be verified.
export async function stripeWebhookHandler(req: Request, res: Response): Promise<void> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers["stripe-signature"];
  if (!isStripeConfigured() || !secret || !signature) {
    res.status(503).json({ error: "Webhook not configured." });
    return;
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      req.body as Buffer,
      signature,
      secret
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid signature";
    res.status(400).send(`Webhook Error: ${message}`);
    return;
  }

  // Idempotency: skip events we've already processed. Crediting a one-off grade
  // isn't naturally idempotent, so we dedupe on the Stripe event id.
  let claimed = false;
  try {
    claimed = await claimStripeEvent(event);
  } catch (err) {
    console.error("Webhook dedup check failed:", err);
    res.status(500).json({ error: "Webhook handler failed." });
    return;
  }
  if (!claimed) {
    res.json({ received: true, duplicate: true });
    return;
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      case "checkout.session.completed":
        await creditGradePurchase(event.data.object as Stripe.Checkout.Session);
        break;
      default:
        break;
    }
  } catch (err) {
    // Processing failed after we claimed the event: release the claim so the
    // Stripe retry reprocesses it instead of being deduped away.
    await releaseStripeEvent(event.id);
    console.error("Webhook handling error:", err);
    res.status(500).json({ error: "Webhook handler failed." });
    return;
  }

  res.json({ received: true });
}

export { router as billingRoutes };
