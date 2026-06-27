import { getServiceClient } from "../../lib/supabase.js";
import { newTradeEnquiryPublicId } from "../adapters/paymentAdapter.js";
import { CollectorProfileError } from "../domain/types.js";
import { isEitherBlocked } from "../infrastructure/blockRepo.js";
import { getCardById } from "../infrastructure/cardRepo.js";
import { getProfileById } from "../infrastructure/profileRepo.js";
import { createConversation } from "./messagingService.js";

const TRADE_STATUSES = new Set([
  "sent",
  "interested",
  "declined",
  "negotiating",
  "completed",
  "cancelled",
]);

function assertTradeableCard(
  card: NonNullable<Awaited<ReturnType<typeof getCardById>>>,
  ownerUserId: string,
  profileId: string
) {
  if (card.owner_user_id !== ownerUserId || card.profile_id !== profileId) {
    throw new CollectorProfileError("COLLECTOR_INVALID_INPUT", "Invalid card.", 400);
  }
  if (card.status !== "active") {
    throw new CollectorProfileError("COLLECTOR_INVALID_INPUT", "Card is not available.", 400);
  }
  if (card.trade_status !== "available" && card.trade_status !== "open_to_offers") {
    throw new CollectorProfileError("COLLECTOR_INVALID_INPUT", "Card is not available for trade.", 400);
  }
}

export function assertTradeEnquiryParticipant(
  enquiry: { sender_user_id: string; recipient_user_id: string },
  userId: string
): void {
  if (enquiry.sender_user_id !== userId && enquiry.recipient_user_id !== userId) {
    throw new CollectorProfileError("COLLECTOR_FORBIDDEN", "Forbidden.", 403);
  }
}

export async function createTradeEnquiry(opts: {
  senderUserId: string;
  recipientProfileId: string;
  recipientUserId: string;
  requestedCardIds: string[];
  offeredCardIds: string[];
  initialMessage?: string;
  cashDifferenceMinorUnits?: number;
  cashDifferenceCurrency?: string;
  fulfilmentPreference?: string;
  locationRegion?: string;
}) {
  if (opts.senderUserId === opts.recipientUserId) {
    throw new CollectorProfileError("COLLECTOR_INVALID_INPUT", "You cannot trade with yourself.", 400);
  }
  if (await isEitherBlocked(opts.senderUserId, opts.recipientUserId)) {
    throw new CollectorProfileError("COLLECTOR_BLOCKED", "You cannot contact this collector.", 403);
  }
  if (opts.requestedCardIds.length === 0) {
    throw new CollectorProfileError("COLLECTOR_INVALID_INPUT", "Select at least one requested card.", 400);
  }

  const recipientProfile = await getProfileById(opts.recipientProfileId);
  if (!recipientProfile) {
    throw new CollectorProfileError("COLLECTOR_INVALID_INPUT", "Recipient not found.", 400);
  }
  if (recipientProfile.user_id !== opts.recipientUserId) {
    throw new CollectorProfileError("COLLECTOR_INVALID_INPUT", "Invalid recipient.", 400);
  }
  if (!recipientProfile.trade_enquiries_enabled) {
    throw new CollectorProfileError("COLLECTOR_FORBIDDEN", "This collector is not accepting trade enquiries.", 403);
  }

  for (const cardId of opts.requestedCardIds) {
    const card = await getCardById(cardId);
    if (!card) {
      throw new CollectorProfileError("COLLECTOR_INVALID_INPUT", "Invalid requested card.", 400);
    }
    assertTradeableCard(card, opts.recipientUserId, opts.recipientProfileId);
  }

  for (const cardId of opts.offeredCardIds) {
    const card = await getCardById(cardId);
    if (!card) {
      throw new CollectorProfileError("COLLECTOR_INVALID_INPUT", "Invalid offered card.", 400);
    }
    assertTradeableCard(card, opts.senderUserId, recipientProfile.id);
  }

  const publicId = newTradeEnquiryPublicId();
  const { data: enquiry, error } = await getServiceClient()
    .from("collector_trade_enquiries")
    .insert({
      public_id: publicId,
      sender_user_id: opts.senderUserId,
      recipient_user_id: opts.recipientUserId,
      recipient_profile_id: opts.recipientProfileId,
      status: "sent",
      cash_difference_minor_units: opts.cashDifferenceMinorUnits ?? null,
      cash_difference_currency: opts.cashDifferenceCurrency ?? null,
      fulfilment_preference: opts.fulfilmentPreference ?? null,
      location_region: opts.locationRegion ?? null,
      initial_message: opts.initialMessage ?? null,
      sent_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;

  if (opts.requestedCardIds.length) {
    await getServiceClient().from("collector_trade_enquiry_requested_cards").insert(
      opts.requestedCardIds.map((card_id) => ({ trade_enquiry_id: enquiry.id, card_id }))
    );
  }
  if (opts.offeredCardIds.length) {
    await getServiceClient().from("collector_trade_enquiry_offered_cards").insert(
      opts.offeredCardIds.map((card_id) => ({ trade_enquiry_id: enquiry.id, card_id }))
    );
  }

  const conv = await createConversation({
    createdByUserId: opts.senderUserId,
    otherUserId: opts.recipientUserId,
    conversationType: "trade_enquiry",
    tradeEnquiryId: enquiry.id,
    initialMessage: opts.initialMessage,
  });

  await getServiceClient()
    .from("collector_trade_enquiries")
    .update({ conversation_id: conv.id })
    .eq("id", enquiry.id);

  return { ...enquiry, conversation_id: conv.id };
}

export async function listTradeEnquiries(userId: string) {
  const { data, error } = await getServiceClient()
    .from("collector_trade_enquiries")
    .select("*")
    .or(`sender_user_id.eq.${userId},recipient_user_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getTradeEnquiryByPublicId(publicId: string) {
  const { data, error } = await getServiceClient()
    .from("collector_trade_enquiries")
    .select("*")
    .eq("public_id", publicId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateTradeEnquiryStatus(publicId: string, status: string, userId: string) {
  if (!TRADE_STATUSES.has(status)) {
    throw new CollectorProfileError("COLLECTOR_INVALID_INPUT", "Invalid status.", 400);
  }
  const enquiry = await getTradeEnquiryByPublicId(publicId);
  if (!enquiry) throw new CollectorProfileError("COLLECTOR_NOT_FOUND", "Trade enquiry not found.", 404);
  assertTradeEnquiryParticipant(enquiry, userId);
  const { data, error } = await getServiceClient()
    .from("collector_trade_enquiries")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("public_id", publicId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
