import { getServiceClient } from "./supabase.js";

export type AdminAuditAction =
  | "role.changed"
  | "plan.changed"
  | "account.suspended"
  | "account.reinstated"
  | "key_limit.changed"
  | "key.created"
  | "key.revoked"
  | "usage.exported"
  | "activity.exported"
  | "invite.sent"
  | "invite.resent";

export function logAdminAudit(input: {
  actorId: string;
  actorEmail?: string | null;
  action: AdminAuditAction;
  targetUserId?: string | null;
  detail?: Record<string, unknown> | null;
}): void {
  getServiceClient()
    .from("admin_audit_log")
    .insert({
      actor_id: input.actorId,
      actor_email: input.actorEmail ?? null,
      action: input.action,
      target_user_id: input.targetUserId ?? null,
      detail: input.detail ?? {},
    })
    .then(
      () => {},
      (err: unknown) => console.error("logAdminAudit failed:", err)
    );
}
