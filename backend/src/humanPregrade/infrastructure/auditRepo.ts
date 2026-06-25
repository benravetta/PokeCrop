import { getServiceClient } from "../../lib/supabase.js";
import type { TransitionContext, HumanPregradeStatus } from "../domain/types.js";

export async function insertStatusHistory(opts: {
  orderId: string;
  fromStatus: HumanPregradeStatus | null;
  toStatus: HumanPregradeStatus;
  ctx: TransitionContext;
}): Promise<void> {
  const { error } = await getServiceClient().from("human_pregrade_status_history").insert({
    order_id: opts.orderId,
    from_status: opts.fromStatus,
    to_status: opts.toStatus,
    actor_type: opts.ctx.actorType,
    actor_id: opts.ctx.actorId,
    reason_code: opts.ctx.reasonCode ?? null,
    reason_text: opts.ctx.reasonText ?? null,
    internal_note: opts.ctx.internalNote ?? null,
    customer_visible_note: opts.ctx.customerVisibleNote ?? null,
    notification_required: opts.ctx.notificationRequired ?? false,
  });
  if (error) throw error;
}

export async function insertAuditLog(opts: {
  orderId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  ctx: TransitionContext;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}): Promise<void> {
  const { error } = await getServiceClient().from("human_pregrade_audit_log").insert({
    order_id: opts.orderId,
    actor_type: opts.ctx.actorType,
    actor_id: opts.ctx.actorId,
    action: opts.action,
    entity_type: opts.entityType,
    entity_id: opts.entityId,
    before_data: opts.before ?? null,
    after_data: opts.after ?? null,
    request_id: opts.ctx.requestId ?? null,
    ip_address: opts.ctx.ipAddress ?? null,
  });
  if (error) throw error;
}

export async function getStaffPermissions(userId: string): Promise<string[]> {
  const { data, error } = await getServiceClient()
    .from("human_pregrade_staff")
    .select("permissions")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return Array.isArray(data?.permissions) ? data.permissions.map(String) : [];
}

export async function listGraders(enabledOnly = true) {
  let q = getServiceClient()
    .from("human_pregrade_graders")
    .select("id, code, name, grade_scale, enabled, display_order")
    .order("display_order");
  if (enabledOnly) q = q.eq("enabled", true);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}
