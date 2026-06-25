import { assertTransition } from "../domain/transitions.js";
import {
  HumanPregradeError,
  type HumanPregradeOrderRow,
  type HumanPregradeStatus,
  type TransitionContext,
} from "../domain/types.js";
import { getOrderById, updateOrder } from "../infrastructure/orderRepo.js";
import { insertAuditLog, insertStatusHistory } from "../infrastructure/auditRepo.js";
import { notifyStatusTransition } from "../adapters/notificationAdapter.js";

const STATUS_TIMESTAMPS: Partial<
  Record<HumanPregradeStatus, keyof HumanPregradeOrderRow>
> = {
  submitted: "submitted_at",
  assigned: "assigned_at",
  under_review: "review_started_at",
  completed: "completed_at",
  cancelled: "cancelled_at",
  refunded: "refunded_at",
};

export async function transitionOrder(
  orderId: string,
  targetStatus: HumanPregradeStatus,
  ctx: TransitionContext
): Promise<HumanPregradeOrderRow> {
  const order = await getOrderById(orderId);
  if (!order) throw new HumanPregradeError("HUMAN_PREGRADE_NOT_FOUND", "Order not found", 404);

  try {
    assertTransition(order.status, targetStatus);
  } catch {
    throw new HumanPregradeError(
      "HUMAN_PREGRADE_INVALID_STATUS",
      `Cannot transition from ${order.status} to ${targetStatus}`,
      409
    );
  }

  const patch: Record<string, unknown> = { status: targetStatus };
  const tsKey = STATUS_TIMESTAMPS[targetStatus];
  if (tsKey) patch[tsKey] = new Date().toISOString();

  const updated = await updateOrder(orderId, patch, order.version);

  await insertStatusHistory({
    orderId,
    fromStatus: order.status,
    toStatus: targetStatus,
    ctx: { ...ctx, notificationRequired: ctx.notificationRequired ?? true },
  });

  await insertAuditLog({
    orderId,
    action: "status.transition",
    entityType: "human_pregrade_order",
    entityId: orderId,
    ctx,
    before: { status: order.status },
    after: { status: targetStatus },
  });

  await notifyStatusTransition(updated, order.status, targetStatus, ctx).catch((err) =>
    console.error("[humanPregrade] notification failed:", err)
  );

  console.info("[humanPregrade]", {
    event: `human_pregrade.${targetStatus}`,
    orderId,
    publicId: updated.public_id,
    actorId: ctx.actorId,
  });

  return updated;
}
