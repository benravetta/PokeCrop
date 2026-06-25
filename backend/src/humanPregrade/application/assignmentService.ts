import { getServiceClient } from "../../lib/supabase.js";
import { HumanPregradeError } from "../domain/types.js";
import { transitionOrder } from "./statusService.js";
import type { TransitionContext } from "../domain/types.js";
import { assertReviewerStaff } from "../api/security.js";

export async function assignOrder(opts: {
  orderId: string;
  reviewerUserId: string;
  assignedByUserId: string;
  ctx: TransitionContext;
}): Promise<void> {
  const sb = getServiceClient();
  const { data: order } = await sb
    .from("human_pregrade_orders")
    .select("id, status")
    .eq("id", opts.orderId)
    .maybeSingle();
  if (!order) throw new HumanPregradeError("HUMAN_PREGRADE_NOT_FOUND", "Order not found", 404);
  if (!["queued", "submitted", "assigned"].includes(String(order.status))) {
    throw new HumanPregradeError("HUMAN_PREGRADE_INVALID_STATUS", "Order not assignable", 409);
  }

  const { data: current } = await sb
    .from("human_pregrade_assignments")
    .select("id")
    .eq("order_id", opts.orderId)
    .eq("is_current", true)
    .maybeSingle();
  if (current) {
    throw new HumanPregradeError("HUMAN_PREGRADE_ALREADY_ASSIGNED", "Already assigned", 409);
  }

  await assertReviewerStaff(opts.reviewerUserId);

  await sb.from("human_pregrade_assignments").insert({
    order_id: opts.orderId,
    reviewer_user_id: opts.reviewerUserId,
    assigned_by_user_id: opts.assignedByUserId,
    is_current: true,
  });

  if (order.status !== "assigned") {
    await transitionOrder(opts.orderId, "assigned", opts.ctx);
  }
}

export async function getCurrentAssignment(orderId: string) {
  const { data } = await getServiceClient()
    .from("human_pregrade_assignments")
    .select("*")
    .eq("order_id", orderId)
    .eq("is_current", true)
    .maybeSingle();
  return data;
}
