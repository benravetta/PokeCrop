import { logActivity } from "../../lib/activity.js";
import { getServiceClient } from "../../lib/supabase.js";
import { newConversationPublicId, newReportPublicId, newModerationCasePublicId } from "../adapters/paymentAdapter.js";
import { CollectorProfileError } from "../domain/types.js";
import { isEitherBlocked } from "../infrastructure/blockRepo.js";
import { getProfileByUserId } from "../infrastructure/profileRepo.js";
import { getCollectorProfileSettings } from "../infrastructure/settingsRepo.js";

const MAX_MESSAGE_LENGTH = 4000;
import { REPORT_REASON_CODES } from "../domain/types.js";

export async function createReport(opts: {
  reporterUserId: string;
  reportedUserId?: string | null;
  entityType: string;
  entityId: string;
  reasonCode: string;
  description?: string;
  conversationId?: string;
  messageId?: string;
}) {
  const settings = await getCollectorProfileSettings();
  const allowedReasons = settings.report_reasons.map(String);
  if (!allowedReasons.includes(opts.reasonCode)) {
    throw new CollectorProfileError("COLLECTOR_INVALID_INPUT", "Invalid report reason.", 400);
  }

  const publicId = newReportPublicId();
  const { data, error } = await getServiceClient()
    .from("collector_reports")
    .insert({
      public_id: publicId,
      reporter_user_id: opts.reporterUserId,
      reported_user_id: opts.reportedUserId ?? null,
      entity_type: opts.entityType,
      entity_id: opts.entityId,
      reason_code: opts.reasonCode,
      description: opts.description ?? null,
      conversation_id: opts.conversationId ?? null,
      message_id: opts.messageId ?? null,
      status: "open",
    })
    .select("*")
    .single();
  if (error) throw error;

  const casePublicId = newModerationCasePublicId();
  await getServiceClient().from("collector_moderation_cases").insert({
    public_id: casePublicId,
    source_report_id: data.id,
    subject_user_id: opts.reportedUserId ?? null,
    status: "open",
    summary: `${opts.entityType} report: ${opts.reasonCode}`,
  });

  logActivity({
    userId: opts.reporterUserId,
    action: "collector.report.created",
    actorId: opts.reporterUserId,
    detail: { entityType: opts.entityType, entityId: opts.entityId, reasonCode: opts.reasonCode },
  });

  return data;
}

export async function createConversation(opts: {
  createdByUserId: string;
  otherUserId: string;
  conversationType?: string;
  tradeEnquiryId?: string;
  cardId?: string;
  initialMessage?: string;
}) {
  if (opts.createdByUserId === opts.otherUserId) {
    throw new CollectorProfileError("COLLECTOR_INVALID_INPUT", "You cannot message yourself.", 400);
  }
  if (await isEitherBlocked(opts.createdByUserId, opts.otherUserId)) {
    throw new CollectorProfileError("COLLECTOR_BLOCKED", "You cannot message this user.", 403);
  }

  if (opts.conversationType !== "trade_enquiry") {
    const recipientProfile = await getProfileByUserId(opts.otherUserId);
    if (!recipientProfile?.messaging_enabled) {
      throw new CollectorProfileError("COLLECTOR_FORBIDDEN", "This collector is not accepting messages.", 403);
    }
  }

  const publicId = newConversationPublicId();
  const { data: conv, error } = await getServiceClient()
    .from("collector_conversations")
    .insert({
      public_id: publicId,
      conversation_type: opts.conversationType ?? "general",
      trade_enquiry_id: opts.tradeEnquiryId ?? null,
      card_id: opts.cardId ?? null,
      created_by_user_id: opts.createdByUserId,
      status: "active",
    })
    .select("*")
    .single();
  if (error) throw error;

  const participants = [
    { conversation_id: conv.id, user_id: opts.createdByUserId, participant_role: "user" },
    { conversation_id: conv.id, user_id: opts.otherUserId, participant_role: "user" },
  ];
  const { data: insertedParts, error: pErr } = await getServiceClient()
    .from("collector_conversation_participants")
    .insert(participants)
    .select("*");
  if (pErr) throw pErr;

  if (opts.initialMessage?.trim()) {
    const sender = insertedParts?.find((p) => p.user_id === opts.createdByUserId);
    if (sender) {
      await sendMessage({
        conversationId: conv.id,
        senderParticipantId: sender.id,
        body: opts.initialMessage.trim(),
        messageType: "text",
      });
    }
  }

  return conv;
}

export async function sendMessage(opts: {
  conversationId: string;
  senderParticipantId: string;
  body?: string;
  messageType?: string;
  cardId?: string;
  attachmentStorageId?: string;
}) {
  const messageType = opts.messageType ?? "text";
  if (messageType === "text" && opts.body && opts.body.length > MAX_MESSAGE_LENGTH) {
    throw new CollectorProfileError("COLLECTOR_INVALID_INPUT", "Message is too long.", 400);
  }

  const { data: senderPart, error: senderErr } = await getServiceClient()
    .from("collector_conversation_participants")
    .select("*, collector_conversations(status)")
    .eq("id", opts.senderParticipantId)
    .eq("conversation_id", opts.conversationId)
    .maybeSingle();
  if (senderErr) throw senderErr;
  if (!senderPart?.user_id) {
    throw new CollectorProfileError("COLLECTOR_FORBIDDEN", "Forbidden.", 403);
  }

  const { data: otherParts, error: otherErr } = await getServiceClient()
    .from("collector_conversation_participants")
    .select("user_id")
    .eq("conversation_id", opts.conversationId)
    .neq("id", opts.senderParticipantId);
  if (otherErr) throw otherErr;
  for (const part of otherParts ?? []) {
    if (part.user_id && (await isEitherBlocked(senderPart.user_id, part.user_id))) {
      throw new CollectorProfileError("COLLECTOR_BLOCKED", "You cannot message this user.", 403);
    }
  }

  const { data, error } = await getServiceClient()
    .from("collector_messages")
    .insert({
      conversation_id: opts.conversationId,
      sender_participant_id: opts.senderParticipantId,
      message_type: messageType,
      body: opts.body ?? null,
      card_id: opts.cardId ?? null,
      attachment_storage_id: opts.attachmentStorageId ?? null,
      status: "sent",
    })
    .select("*")
    .single();
  if (error) throw error;

  await getServiceClient()
    .from("collector_conversations")
    .update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", opts.conversationId);

  return data;
}

export async function listConversationsForUser(userId: string) {
  const { data: parts, error } = await getServiceClient()
    .from("collector_conversation_participants")
    .select("*, collector_conversations(*)")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .order("joined_at", { ascending: false });
  if (error) throw error;
  return parts ?? [];
}

export async function getConversationByPublicId(publicId: string) {
  const { data, error } = await getServiceClient()
    .from("collector_conversations")
    .select("*")
    .eq("public_id", publicId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getParticipant(conversationId: string, userId: string) {
  const { data, error } = await getServiceClient()
    .from("collector_conversation_participants")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listMessages(conversationId: string, viewerParticipantId?: string) {
  const { data, error } = await getServiceClient()
    .from("collector_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("sent_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).filter((m) => {
    if (m.removed_by_moderator_at) return Boolean(viewerParticipantId);
    return true;
  });
}

export async function getMessageById(messageId: string) {
  const { data, error } = await getServiceClient()
    .from("collector_messages")
    .select("*")
    .eq("id", messageId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function markConversationRead(conversationId: string, participantId: string, messageId: string) {
  const { data: message, error: msgErr } = await getServiceClient()
    .from("collector_messages")
    .select("id")
    .eq("id", messageId)
    .eq("conversation_id", conversationId)
    .maybeSingle();
  if (msgErr) throw msgErr;
  if (!message) {
    throw new CollectorProfileError("COLLECTOR_INVALID_INPUT", "Message not found.", 400);
  }

  await getServiceClient()
    .from("collector_conversation_participants")
    .update({ last_read_message_id: messageId })
    .eq("id", participantId)
    .eq("conversation_id", conversationId);
}

export async function setConversationMuted(participantId: string, muted: boolean) {
  await getServiceClient()
    .from("collector_conversation_participants")
    .update({ is_muted: muted })
    .eq("id", participantId);
}

export async function setConversationArchived(participantId: string, archived: boolean) {
  await getServiceClient()
    .from("collector_conversation_participants")
    .update({ is_archived: archived })
    .eq("id", participantId);
}

export async function adminJoinConversation(opts: {
  conversationId: string;
  adminUserId: string;
  notice: string;
}) {
  const { data: part, error } = await getServiceClient()
    .from("collector_conversation_participants")
    .insert({
      conversation_id: opts.conversationId,
      admin_user_id: opts.adminUserId,
      participant_role: "administrator",
    })
    .select("*")
    .single();
  if (error) throw error;

  await getServiceClient()
    .from("collector_conversations")
    .update({ admin_intervention_active: true, updated_at: new Date().toISOString() })
    .eq("id", opts.conversationId);

  await sendMessage({
    conversationId: opts.conversationId,
    senderParticipantId: part.id,
    body: opts.notice,
    messageType: "moderator_notice",
  });
}

export async function freezeConversation(conversationId: string) {
  await getServiceClient()
    .from("collector_conversations")
    .update({ status: "frozen", updated_at: new Date().toISOString() })
    .eq("id", conversationId);
}
