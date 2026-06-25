import type Stripe from "stripe";
import { getStripe, isStripeConfigured, isHumanPregradePriceConfigured } from "../../lib/stripe.js";
import { getServiceClient } from "../../lib/supabase.js";
import { HumanPregradeError, type HumanPregradeOrderRow } from "../domain/types.js";
import { transitionOrder } from "../application/statusService.js";
import { assertReviewerStaff } from "../api/security.js";

export async function createHumanPregradeCheckout(opts: {
  order: HumanPregradeOrderRow;
  userEmail: string | undefined;
  origin: string;
  customerId: string;
}): Promise<{ url: string; sessionId: string }> {
  if (!isStripeConfigured() || !isHumanPregradePriceConfigured()) {
    throw new HumanPregradeError("HUMAN_PREGRADE_PAYMENT_REQUIRED", "Billing not configured", 503);
  }
  if (opts.order.status !== "awaiting_payment" && opts.order.status !== "draft") {
    throw new HumanPregradeError(
      "HUMAN_PREGRADE_INVALID_STATUS",
      "Order is not awaiting payment",
      409
    );
  }
  if (opts.order.price_minor_units <= 0) {
    throw new HumanPregradeError("HUMAN_PREGRADE_PAYMENT_REQUIRED", "Invalid order price", 400);
  }

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    customer: opts.customerId,
    line_items: [
      {
        price_data: {
          currency: opts.order.currency.toLowerCase(),
          unit_amount: opts.order.price_minor_units,
          product_data: {
            name: opts.order.service_name_snapshot || "GemCheck Expert Review",
          },
        },
        quantity: 1,
      },
    ],
    client_reference_id: opts.order.user_id,
    metadata: {
      user_id: opts.order.user_id,
      product: "human_pregrade",
      order_public_id: opts.order.public_id,
      order_id: opts.order.id,
    },
    payment_intent_data: {
      metadata: {
        user_id: opts.order.user_id,
        product: "human_pregrade",
        order_public_id: opts.order.public_id,
        order_id: opts.order.id,
      },
    },
    success_url: `${opts.origin}/human-pregrade/orders/${opts.order.public_id}?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${opts.origin}/human-pregrade/orders/${opts.order.public_id}?purchase=cancel`,
  });

  if (!session.url) throw new Error("Stripe session missing url");

  await getServiceClient().from("human_pregrade_payments").upsert(
    {
      order_id: opts.order.id,
      stripe_session_id: session.id,
      amount_minor_units: opts.order.price_minor_units,
      currency: opts.order.currency,
      status: "pending",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "order_id" }
  );

  return { url: session.url, sessionId: session.id };
}

export async function handleHumanPregradeStripeSession(
  session: Stripe.Checkout.Session
): Promise<boolean> {
  if (session.metadata?.product !== "human_pregrade") return false;
  if (session.payment_status !== "paid") return false;

  const orderId = session.metadata?.order_id as string | undefined;
  const metaUserId = session.metadata?.user_id as string | undefined;
  if (!orderId || !metaUserId) return false;

  const sb = getServiceClient();
  const { data: order } = await sb
    .from("human_pregrade_orders")
    .select("id, user_id, status, price_minor_units, currency")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) {
    console.error("[humanPregrade] webhook order not found", orderId);
    return false;
  }
  if (String(order.user_id) !== metaUserId) {
    console.error("[humanPregrade] webhook user_id mismatch", orderId);
    return false;
  }
  if (!["awaiting_payment", "draft"].includes(String(order.status))) {
    const { data: payRow } = await sb
      .from("human_pregrade_payments")
      .select("status")
      .eq("order_id", orderId)
      .maybeSingle();
    if (payRow?.status === "paid") return true;
    console.error("[humanPregrade] webhook invalid order status", order.status);
    return false;
  }

  const { data: payment } = await sb
    .from("human_pregrade_payments")
    .select("status, stripe_session_id, amount_minor_units, currency")
    .eq("order_id", orderId)
    .maybeSingle();

  if (payment?.status === "paid") return true;

  if (payment?.stripe_session_id && payment.stripe_session_id !== session.id) {
    console.error("[humanPregrade] webhook session id mismatch", orderId);
    return false;
  }

  const paidAmount = session.amount_total ?? 0;
  const expectedAmount = Number(payment?.amount_minor_units ?? order.price_minor_units);
  if (paidAmount !== expectedAmount) {
    console.error("[humanPregrade] webhook amount mismatch", { paidAmount, expectedAmount });
    return false;
  }

  const paidCurrency = (session.currency ?? "").toUpperCase();
  const expectedCurrency = String(payment?.currency ?? order.currency).toUpperCase();
  if (paidCurrency && expectedCurrency && paidCurrency !== expectedCurrency) {
    console.error("[humanPregrade] webhook currency mismatch", { paidCurrency, expectedCurrency });
    return false;
  }

  const pi =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  await sb
    .from("human_pregrade_payments")
    .update({
      status: "paid",
      stripe_session_id: session.id,
      stripe_payment_intent_id: pi ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("order_id", orderId);

  await sb
    .from("human_pregrade_orders")
    .update({
      payment_reference: session.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  await transitionOrder(orderId, "paid", {
    actorType: "system",
    actorId: null,
    reasonCode: "payment_confirmed",
    customerVisibleNote: "Payment received",
  });

  console.info("[humanPregrade]", {
    event: "human_pregrade.payment_confirmed",
    orderId,
    sessionId: session.id,
  });
  return true;
}

export async function issueHumanPregradeRefund(orderId: string): Promise<void> {
  const sb = getServiceClient();
  const { data: order } = await sb
    .from("human_pregrade_orders")
    .select("status")
    .eq("id", orderId)
    .maybeSingle();
  if (order?.status === "refunded") {
    throw new HumanPregradeError("HUMAN_PREGRADE_INVALID_STATUS", "Already refunded", 409);
  }

  const { data: pay } = await sb
    .from("human_pregrade_payments")
    .select("stripe_payment_intent_id, status")
    .eq("order_id", orderId)
    .maybeSingle();
  if (!pay?.stripe_payment_intent_id) {
    throw new HumanPregradeError("HUMAN_PREGRADE_REFUND_FAILED", "No payment to refund", 400);
  }
  if (pay.status === "refunded") {
    throw new HumanPregradeError("HUMAN_PREGRADE_INVALID_STATUS", "Already refunded", 409);
  }

  await getStripe().refunds.create({ payment_intent: String(pay.stripe_payment_intent_id) });
  await sb
    .from("human_pregrade_payments")
    .update({ status: "refunded", updated_at: new Date().toISOString() })
    .eq("order_id", orderId);
}
