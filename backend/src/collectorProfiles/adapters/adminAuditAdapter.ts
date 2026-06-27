import { getServiceClient } from "../../lib/supabase.js";

export async function logAdminConversationAccess(opts: {
  caseId: string;
  adminUserId: string;
  conversationId?: string;
  accessType: string;
  accessReason: string;
  scope: string;
  requestId?: string;
  ipAddress?: string;
}): Promise<void> {
  await getServiceClient().from("collector_admin_access_log").insert({
    case_id: opts.caseId,
    admin_user_id: opts.adminUserId,
    conversation_id: opts.conversationId ?? null,
    access_type: opts.accessType,
    access_reason: opts.accessReason,
    scope: opts.scope,
    request_id: opts.requestId ?? null,
    ip_address: opts.ipAddress ?? null,
  });
}
