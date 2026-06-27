import { getServiceClient } from "../../lib/supabase.js";
import { getStripe, isStripeConfigured, isGradeSinglePriceConfigured } from "../../lib/stripe.js";
import { GRADE_SINGLE_PRICE } from "../../lib/stripe.js";
import { getValidatedReservation } from "./entitlementAdapter.js";
import { CollectorProfileError, generatePublicId } from "../domain/types.js";

export async function createCollectorGradeCheckout(opts: {
  userId: string;
  userEmail: string | undefined;
  cardId: string;
  cardPublicId: string;
  reservationId: string;
  origin: string;
  customerId: string;
}): Promise<{ url: string; sessionId: string }> {
  if (!isStripeConfigured() || !isGradeSinglePriceConfigured()) {
    throw new CollectorProfileError("COLLECTOR_PAYMENT_REQUIRED", "Billing not configured.", 503);
  }
  await getValidatedReservation(opts.reservationId, opts.userId, opts.cardId);
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    customer: opts.customerId,
    line_items: [{ price: GRADE_SINGLE_PRICE, quantity: 1 }],
    client_reference_id: opts.userId,
    metadata: {
      user_id: opts.userId,
      product: "collector_profile_grade",
      card_id: opts.cardId,
      card_public_id: opts.cardPublicId,
      reservation_id: opts.reservationId,
    },
    payment_intent_data: {
      metadata: {
        user_id: opts.userId,
        product: "collector_profile_grade",
        card_id: opts.cardId,
        reservation_id: opts.reservationId,
      },
    },
    success_url: `${opts.origin}/u/${encodeURIComponent(opts.cardPublicId)}?gradePurchase=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${opts.origin}/collector/cards/${encodeURIComponent(opts.cardPublicId)}/edit?gradePurchase=cancel`,
  });
  if (!session.url) throw new Error("Stripe session missing url");

  await getServiceClient()
    .from("collector_entitlement_reservations")
    .update({ stripe_session_id: session.id })
    .eq("id", opts.reservationId);

  return { url: session.url, sessionId: session.id };
}

export async function handleCollectorProfileStripeSession(
  session: import("stripe").Stripe.Checkout.Session
): Promise<void> {
  const reservationId = session.metadata?.reservation_id;
  if (!reservationId) return;
  await getServiceClient()
    .from("collector_entitlement_reservations")
    .update({ status: "reserved" })
    .eq("id", reservationId)
    .eq("status", "reserved");
  void session;
}

export function newTradeEnquiryPublicId(): string {
  return generatePublicId("te");
}

export function newConversationPublicId(): string {
  return generatePublicId("cv");
}

export function newReportPublicId(): string {
  return generatePublicId("rp");
}

export function newModerationCasePublicId(): string {
  return generatePublicId("mc");
}
