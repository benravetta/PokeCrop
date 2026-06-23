import type Stripe from "stripe";
import { getServiceClient } from "./supabase.js";
import { logActivity } from "./activity.js";

function paymentIntentId(session: Stripe.Checkout.Session): string | null {
  const pi = session.payment_intent;
  if (!pi) return null;
  return typeof pi === "string" ? pi : pi.id;
}

/** Idempotent credit from a paid one-time Checkout session. */
export async function creditGradePurchase(session: Stripe.Checkout.Session): Promise<boolean> {
  if (session.mode !== "payment") return false;
  const meta = session.metadata ?? {};
  if (meta.product !== "grade_single") return false;
  if (session.payment_status !== "paid") return false;

  const userId =
    (meta.user_id as string | undefined) || session.client_reference_id || undefined;
  if (!userId) {
    console.warn("grade purchase with no resolvable user:", session.id);
    return false;
  }

  const qty = Math.max(1, parseInt((meta.qty as string) || "1", 10) || 1);
  const sb = getServiceClient();
  const { data, error } = await sb.rpc("credit_grade_purchase", {
    p_user: userId,
    p_session_id: session.id,
    p_payment_intent_id: paymentIntentId(session),
    p_qty: qty,
  });
  if (error) throw error;
  if (data !== true) return false;

  logActivity({
    userId,
    action: "grade.credit.purchased",
    detail: { qty, source: "stripe", session: session.id },
  });
  return true;
}

export async function refundGradePurchase(opts: {
  sessionId?: string | null;
  paymentIntentId?: string | null;
}): Promise<number> {
  const sb = getServiceClient();
  const { data, error } = await sb.rpc("refund_grade_purchase", {
    p_session_id: opts.sessionId ?? null,
    p_payment_intent_id: opts.paymentIntentId ?? null,
  });
  if (error) throw error;
  return typeof data === "number" ? data : 0;
}

export async function markGradePurchaseDisputed(paymentIntentId: string): Promise<boolean> {
  const sb = getServiceClient();
  const { data, error } = await sb.rpc("mark_grade_purchase_disputed", {
    p_payment_intent_id: paymentIntentId,
  });
  if (error) throw error;
  return data === true;
}

export async function isPurchaseCredited(
  userId: string,
  sessionId: string
): Promise<boolean> {
  const { data } = await getServiceClient()
    .from("grade_purchases")
    .select("id")
    .eq("user_id", userId)
    .eq("stripe_session_id", sessionId)
    .maybeSingle();
  return Boolean(data);
}
