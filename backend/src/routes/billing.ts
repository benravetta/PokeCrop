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
import {
  creditGradePurchase,
  refundGradePurchase,
  markGradePurchaseDisputed,
  isPurchaseCredited,
} from "../lib/billingPurchases.js";

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
        metadata: { user_id: userId, product: "grade_single", qty: "1" },
        payment_intent_data: {
          metadata: { user_id: userId, product: "grade_single", qty: "1" },
        },
        allow_promotion_codes: true,
        success_url: `${origin}/grade?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/grade?purchase=cancel`,
      });

      res.json({ url: session.url, sessionId: session.id });
    } catch (err) {
      console.error("Grade checkout creation failed:", err);
      res.status(500).json({ error: "Could not start checkout." });
    }
  }
);

// Poll after Checkout return — confirms webhook credit landed (or triggers recovery).
router.get(
  "/billing/purchase-status",
  requireAuth,
  async (req: Request, res: Response) => {
    const sessionId = typeof req.query.session_id === "string" ? req.query.session_id : "";
    if (!sessionId) {
      res.status(400).json({ error: "session_id is required." });
      return;
    }
    if (!isStripeConfigured()) {
      res.status(503).json({ error: "Billing is not configured." });
      return;
    }

    const userId = req.user!.id;

    if (await isPurchaseCredited(userId, sessionId)) {
      res.json({ status: "credited" });
      return;
    }

    try {
      const session = await getStripe().checkout.sessions.retrieve(sessionId);
      if (session.client_reference_id && session.client_reference_id !== userId) {
        res.status(403).json({ error: "Session does not belong to this account." });
        return;
      }

      if (session.payment_status === "paid") {
        const credited = await creditGradePurchase(session);
        res.json({ status: credited ? "credited" : "already_credited" });
        return;
      }

      if (session.status === "expired") {
        res.json({ status: "expired" });
        return;
      }

      res.json({
        status: session.status === "open" ? "pending" : "unpaid",
        payment_status: session.payment_status,
      });
    } catch (err) {
      console.error("purchase-status failed:", err);
      res.status(500).json({ error: "Could not load purchase status." });
    }
  }
);

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
  if (error) throw error;

  logActivity({
    userId,
    action: "subscription.synced",
    detail: { plan, status: sub.status, source: "stripe" },
  });
}

async function syncSubscriptionFromInvoice(invoice: Stripe.Invoice): Promise<void> {
  const subRef = invoice.subscription;
  if (!subRef) return;
  const subId = typeof subRef === "string" ? subRef : subRef.id;
  const sub = await getStripe().subscriptions.retrieve(subId);
  await syncSubscription(sub);
}

function paymentIntentIdFromCharge(charge: Stripe.Charge): string | null {
  const pi = charge.payment_intent;
  if (!pi) return null;
  return typeof pi === "string" ? pi : pi.id;
}

async function handleCheckoutSession(session: Stripe.Checkout.Session): Promise<void> {
  if (session.mode !== "payment") return;
  if (session.metadata?.product !== "grade_single") return;

  if (session.payment_status === "paid") {
    await creditGradePurchase(session);
    return;
  }

  if (session.payment_status === "unpaid") {
    logActivity({
      userId: session.client_reference_id ?? undefined,
      action: "grade.purchase.async_failed",
      detail: { session: session.id, payment_status: session.payment_status },
    });
  }
}

async function handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
  const pi = paymentIntentIdFromCharge(charge);
  if (!pi) return;

  const revoked = await refundGradePurchase({ paymentIntentId: pi });
  if (revoked > 0) {
    logActivity({
      action: "grade.credit.refunded",
      detail: { payment_intent: pi, revoked, charge: charge.id },
    });
  } else {
    logActivity({
      action: "grade.credit.refund_no_balance",
      detail: {
        payment_intent: pi,
        charge: charge.id,
        note: "Purchase already refunded or credits already consumed",
      },
    });
  }
}

async function claimStripeEvent(event: Stripe.Event): Promise<boolean> {
  const sb = getServiceClient();
  const { error } = await sb
    .from("stripe_events")
    .insert({ id: event.id, type: event.type });
  if (error) {
    if ((error as { code?: string }).code === "23505") return false;
    throw error;
  }
  return true;
}

async function releaseStripeEvent(eventId: string): Promise<void> {
  try {
    await getServiceClient().from("stripe_events").delete().eq("id", eventId);
  } catch (err) {
    console.error("Failed to release Stripe event claim:", err);
  }
}

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
      case "invoice.payment_failed":
        await syncSubscriptionFromInvoice(event.data.object as Stripe.Invoice);
        break;
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await handleCheckoutSession(event.data.object as Stripe.Checkout.Session);
        break;
      case "checkout.session.async_payment_failed":
        await handleCheckoutSession(event.data.object as Stripe.Checkout.Session);
        break;
      case "checkout.session.expired":
        logActivity({
          action: "grade.checkout.expired",
          detail: { session: (event.data.object as Stripe.Checkout.Session).id },
        });
        break;
      case "charge.refunded":
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;
      case "charge.dispute.created": {
        const charge = event.data.object as Stripe.Charge;
        const pi = paymentIntentIdFromCharge(charge);
        if (pi) {
          await markGradePurchaseDisputed(pi);
          logActivity({
            action: "grade.purchase.disputed",
            detail: { payment_intent: pi, charge: charge.id },
          });
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    await releaseStripeEvent(event.id);
    console.error("Webhook handling error:", err);
    res.status(500).json({ error: "Webhook handler failed." });
    return;
  }

  res.json({ received: true });
}

export { router as billingRoutes };
