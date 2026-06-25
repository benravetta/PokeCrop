import { logActivity, type ActivityAction } from "../../lib/activity.js";
import { getServiceClient } from "../../lib/supabase.js";
import type { HumanPregradeOrderRow, HumanPregradeStatus, TransitionContext } from "../domain/types.js";
import { CUSTOMER_STATUS_LABELS } from "../domain/transitions.js";

const EVENT_MAP: Partial<Record<HumanPregradeStatus, string>> = {
  paid: "order_paid",
  submitted: "order_submitted",
  assigned: "review_assigned",
  under_review: "review_started",
  awaiting_customer_images: "additional_images_requested",
  customer_images_received: "additional_images_received",
  quality_check: "report_in_quality_check",
  completed: "report_completed",
  unable_to_assess: "order_unable_to_assess",
  cancelled: "order_cancelled",
  refunded: "refund_processed",
};

const ACTIVITY_ACTION: Record<string, ActivityAction> = {
  order_paid: "human_pregrade.order_paid",
  order_submitted: "human_pregrade.order_submitted",
  review_assigned: "human_pregrade.review_assigned",
  review_started: "human_pregrade.review_started",
  additional_images_requested: "human_pregrade.additional_images_requested",
  additional_images_received: "human_pregrade.additional_images_received",
  report_in_quality_check: "human_pregrade.report_in_quality_check",
  report_completed: "human_pregrade.report_completed",
  order_unable_to_assess: "human_pregrade.order_unable_to_assess",
  order_cancelled: "human_pregrade.order_cancelled",
  refund_processed: "human_pregrade.refund_processed",
};

export async function notifyStatusTransition(
  order: HumanPregradeOrderRow,
  _from: HumanPregradeStatus,
  to: HumanPregradeStatus,
  ctx: TransitionContext
): Promise<void> {
  const eventType = EVENT_MAP[to];
  if (!eventType) return;

  const idempotencyKey = `${order.id}:${eventType}:${order.version}`;
  const sb = getServiceClient();
  const { error: dupErr } = await sb.from("human_pregrade_notification_deliveries").insert({
    order_id: order.id,
    event_type: eventType,
    idempotency_key: idempotencyKey,
  });
  if (dupErr?.code === "23505") return;

  const label = CUSTOMER_STATUS_LABELS[to];
  await sb.from("human_pregrade_messages").insert({
    order_id: order.id,
    sender_type: "system",
    sender_id: null,
    message_type: eventType,
    body: ctx.customerVisibleNote ?? `Order status: ${label}`,
    customer_visible: true,
    action_required: to === "awaiting_customer_images",
  });

  logActivity({
    userId: order.user_id,
    action: ACTIVITY_ACTION[eventType] ?? "human_pregrade.order_submitted",
    actorId: ctx.actorId,
    detail: { orderId: order.id, publicId: order.public_id, status: to },
  });

  await sb
    .from("human_pregrade_status_history")
    .update({ notification_sent_at: new Date().toISOString() })
    .eq("order_id", order.id)
    .eq("to_status", to)
    .is("notification_sent_at", null);
}
