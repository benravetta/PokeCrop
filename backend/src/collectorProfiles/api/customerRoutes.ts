import { Router, type Request, type Response } from "express";
import multer from "multer";
import { requireActiveAuth, optionalAuth } from "../../middleware/auth.js";
import { getStripe, isStripeConfigured } from "../../lib/stripe.js";
import { getServiceClient } from "../../lib/supabase.js";
import {
  requireCollectorProfilesEnabled,
  requireCollectorGradingEnabled,
  requireCollectorMessagingEnabled,
  requireCollectorTradeEnabled,
  sendCollectorProfileError,
} from "./middleware.js";
import { collectorRateLimit } from "./rateLimit.js";
import { sanitizeBio, sanitizeExternalUrl } from "./security.js";
import {
  createProfile,
  getProfileByUserId,
  updateProfile,
  changeUsername,
  publishProfile,
  unpublishProfile,
  replaceProfileInterests,
  replaceProfileLinks,
  replaceSectionOrder,
  getSectionOrder,
  listProfileInterests,
  listProfileLinks,
  resolveUsernameRedirect,
  listDiscoverableProfiles,
} from "../infrastructure/profileRepo.js";
import { getCollectorProfileSettings } from "../infrastructure/settingsRepo.js";
import { buildPublicProfileView, buildPublicCardView, assertCanInitiateGrade } from "../application/publicProfileService.js";
import { createReport, getMessageById } from "../application/messagingService.js";
import {
  assertCardOwner,
  assertCardSectionLimits,
  createCard,
  getCardById,
  getCardByPublicId,
  listCardsForProfile,
  updateCard,
  softDeleteCard,
  setCardSections,
  getCardSections,
  upsertCardImage,
  listCardImages,
  publishCard,
  loadImageBuffer,
  insertGradeLink,
  publishGradeLink,
  getGradeLinks,
} from "../infrastructure/cardRepo.js";
import {
  uploadCardOriginal,
  uploadProfileImage,
  getSignedStorageUrl,
  putPublicDerivative,
} from "../adapters/storageAdapter.js";
import { detectCardBoundary, processCardImageCrop } from "../adapters/cardProcessor.js";
import {
  getAvailableEntitlements,
  reserveEntitlement,
  releaseReservation,
  consumeReservedEntitlement,
  getLatestUsageEventId,
} from "../adapters/entitlementAdapter.js";
import { gradeFromBuffers } from "../adapters/gradingAdapter.js";
import { createCollectorGradeCheckout } from "../adapters/paymentAdapter.js";
import {
  createTradeEnquiry,
  getTradeEnquiryByPublicId,
  listTradeEnquiries,
  updateTradeEnquiryStatus,
  assertTradeEnquiryParticipant,
} from "../application/tradeEnquiryService.js";
import {
  createConversation,
  getConversationByPublicId,
  getParticipant,
  listConversationsForUser,
  listMessages,
  markConversationRead,
  sendMessage,
  setConversationArchived,
  setConversationMuted,
} from "../application/messagingService.js";
import { blockUser, listBlocks, unblockUser } from "../infrastructure/blockRepo.js";
import { notifyCollectorEvent } from "../adapters/notificationAdapter.js";
import { CollectorProfileError } from "../domain/types.js";
import { isCollectorProfilesEnvEnabled } from "../domain/featureFlag.js";
import { isCollectorProfilesFeatureEnabled } from "../infrastructure/settingsRepo.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 52_428_800 },
});

export const collectorProfilesPublicRoutes = Router();
export const collectorProfilesCustomerRoutes = Router();

async function getOrCreateStripeCustomer(userId: string, email?: string): Promise<string> {
  const sb = getServiceClient();
  const { data } = await sb
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (data?.stripe_customer_id) return data.stripe_customer_id;
  const customer = await getStripe().customers.create({ email, metadata: { user_id: userId } });
  await sb.from("subscriptions").upsert(
    { user_id: userId, stripe_customer_id: customer.id, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
  return customer.id;
}

function publicOrigin(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] ?? "http";
  const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost:5173";
  return `${proto}://${host}`.replace(/\/$/, "");
}

collectorProfilesPublicRoutes.get("/collector/config/public", async (_req, res) => {
  if (!isCollectorProfilesEnvEnabled()) {
    res.status(404).json({ error: "Not found." });
    return;
  }
  try {
    const enabled = await isCollectorProfilesFeatureEnabled();
    res.json({ enabled });
  } catch (err) {
    sendCollectorProfileError(res, err);
  }
});

collectorProfilesPublicRoutes.get(
  "/collector/profiles/:username",
  optionalAuth,
  requireCollectorProfilesEnabled,
  async (req, res) => {
    try {
      const view = await buildPublicProfileView({
        username: req.params.username!,
        viewerUserId: req.user?.id,
      });
      if (view.redirectUsername) {
        res.redirect(301, `/api/collector/profiles/${encodeURIComponent(view.redirectUsername)}`);
        return;
      }
      res.json(view);
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesCustomerRoutes.get(
  "/collector/config",
  requireActiveAuth,
  requireCollectorProfilesEnabled,
  async (_req, res) => {
    try {
      const settings = await getCollectorProfileSettings();
      res.json({
        enabled: settings.collector_profiles_enabled,
        messagingEnabled: settings.collector_profile_messaging_enabled,
        gradingEnabled: settings.collector_profile_grading_enabled,
        discoveryEnabled: settings.collector_profile_discovery_enabled,
        tradeEnquiriesEnabled: settings.collector_profile_trade_enquiries_enabled,
        supportedCardGames: settings.supported_card_games,
        allowViewerGradingDefault: settings.allow_viewer_grading_default,
        reportReasons: settings.report_reasons.map(String),
      });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesCustomerRoutes.post(
  "/collector/profile",
  requireActiveAuth,
  requireCollectorProfilesEnabled,
  async (req, res) => {
    try {
      const settings = await getCollectorProfileSettings();
      const profile = await createProfile({
        userId: req.user!.id,
        username: String(req.body?.username ?? ""),
        displayName: String(req.body?.displayName ?? req.body?.display_name ?? ""),
        allowViewerGradingDefault: settings.allow_viewer_grading_default,
      });
      res.status(201).json({ profile });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesCustomerRoutes.get(
  "/collector/profile/me",
  requireActiveAuth,
  requireCollectorProfilesEnabled,
  async (req, res) => {
    try {
      const profile = await getProfileByUserId(req.user!.id);
      if (!profile) {
        res.status(404).json({ error: "No profile yet.", error_code: "COLLECTOR_NOT_FOUND" });
        return;
      }
      const [interests, links, sections] = await Promise.all([
        listProfileInterests(profile.id),
        listProfileLinks(profile.id),
        getSectionOrder(profile.id),
      ]);
      res.json({ profile, interests, links, sections });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesCustomerRoutes.patch(
  "/collector/profile/me",
  requireActiveAuth,
  requireCollectorProfilesEnabled,
  async (req, res) => {
    try {
      const profile = await getProfileByUserId(req.user!.id);
      if (!profile) throw new CollectorProfileError("COLLECTOR_NOT_FOUND", "No profile yet.", 404);
      const body = req.body ?? {};
      let updated = profile;
      if (body.username && body.username !== profile.username) {
        const settings = await getCollectorProfileSettings();
        updated = await changeUsername(profile, String(body.username), settings.username_change_interval_days);
      }
      const featuredCardId = body.featuredCardId ?? body.featured_card_id;
      if (featuredCardId) {
        const featured = await getCardById(String(featuredCardId));
        if (!featured || featured.profile_id !== updated.id) {
          throw new CollectorProfileError("COLLECTOR_INVALID_INPUT", "Invalid featured card.", 400);
        }
      }
      updated = await updateProfile(updated.id, {
        display_name: body.displayName ?? body.display_name,
        bio: sanitizeBio(body.bio),
        location_region: body.locationRegion ?? body.location_region,
        country_code: body.countryCode ?? body.country_code,
        accent_setting: body.accentSetting ?? body.accent_setting,
        appearance_setting: body.appearanceSetting ?? body.appearance_setting,
        visibility: body.visibility,
        search_visible: body.searchVisible ?? body.search_visible,
        search_engine_indexing: body.searchEngineIndexing ?? body.search_engine_indexing,
        trade_enquiries_enabled: body.tradeEnquiriesEnabled ?? body.trade_enquiries_enabled,
        messaging_enabled: body.messagingEnabled ?? body.messaging_enabled,
        allow_viewer_grading: body.allowViewerGrading ?? body.allow_viewer_grading,
        featured_card_id: body.featuredCardId ?? body.featured_card_id,
      });
      if (Array.isArray(body.interests)) {
        await replaceProfileInterests(
          updated.id,
          body.interests.map((i: Record<string, unknown>, idx: number) => ({
            interest_type: String(i.interest_type ?? i.type ?? "general"),
            interest_value: String(i.interest_value ?? i.value ?? ""),
            display_order: Number(i.display_order ?? idx),
          }))
        );
      }
      if (Array.isArray(body.links)) {
        await replaceProfileLinks(
          updated.id,
          body.links
            .map((l: Record<string, unknown>, idx: number) => {
              const url = sanitizeExternalUrl(String(l.url ?? ""));
              if (!url) return null;
              return {
                platform: String(l.platform ?? "other"),
                label: String(l.label ?? "Link").slice(0, 80),
                url,
                display_order: Number(l.display_order ?? idx),
                is_visible: l.is_visible !== false && l.isVisible !== false,
              };
            })
            .filter(Boolean) as {
            platform: string;
            label: string;
            url: string;
            display_order: number;
            is_visible: boolean;
          }[]
        );
      }
      if (Array.isArray(body.sections)) {
        await replaceSectionOrder(updated.id, body.sections);
      }
      res.json({ profile: updated });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesCustomerRoutes.post(
  "/collector/profile/me/publish",
  requireActiveAuth,
  requireCollectorProfilesEnabled,
  async (req, res) => {
    try {
      const profile = await getProfileByUserId(req.user!.id);
      if (!profile) throw new CollectorProfileError("COLLECTOR_NOT_FOUND", "No profile yet.", 404);
      const published = await publishProfile(profile.id);
      await notifyCollectorEvent({
        userId: req.user!.id,
        eventType: "profile_published",
        entityId: profile.id,
        preview: "Your collector profile is now live.",
      });
      res.json({ profile: published });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesCustomerRoutes.post(
  "/collector/profile/me/unpublish",
  requireActiveAuth,
  requireCollectorProfilesEnabled,
  async (req, res) => {
    try {
      const profile = await getProfileByUserId(req.user!.id);
      if (!profile) throw new CollectorProfileError("COLLECTOR_NOT_FOUND", "No profile yet.", 404);
      const unpublished = await unpublishProfile(profile.id);
      res.json({ profile: unpublished });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesCustomerRoutes.post(
  "/collector/profiles/:username/report",
  requireActiveAuth,
  requireCollectorProfilesEnabled,
  async (req, res) => {
    try {
      const resolved = await resolveUsernameRedirect(req.params.username!);
      if (!resolved) throw new CollectorProfileError("COLLECTOR_NOT_FOUND", "Profile not found.", 404);
      const report = await createReport({
        reporterUserId: req.user!.id,
        reportedUserId: resolved.profile.user_id,
        entityType: "profile",
        entityId: resolved.profile.id,
        reasonCode: String(req.body?.reasonCode ?? req.body?.reason_code ?? "other"),
        description: req.body?.description,
      });
      res.status(201).json({ report });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

// Cards
collectorProfilesCustomerRoutes.post(
  "/collector/cards",
  requireActiveAuth,
  requireCollectorProfilesEnabled,
  async (req, res) => {
    try {
      const profile = await getProfileByUserId(req.user!.id);
      if (!profile) throw new CollectorProfileError("COLLECTOR_NOT_FOUND", "Create a profile first.", 404);
      const settings = await getCollectorProfileSettings();
      const existing = await listCardsForProfile(profile.id);
      if (existing.length >= settings.max_cards_per_profile) {
        throw new CollectorProfileError(
          "COLLECTOR_INVALID_INPUT",
          "You have reached the maximum number of cards for your profile.",
          400
        );
      }
      const card = await createCard({
        ownerUserId: req.user!.id,
        profileId: profile.id,
        patch: req.body ?? {},
      });
      if (Array.isArray(req.body?.sections)) {
        const sectionRows = req.body.sections.map((s: string | Record<string, unknown>, idx: number) =>
          typeof s === "string"
            ? { section: s, display_order: idx }
            : { section: String(s.section), display_order: Number(s.display_order ?? idx) }
        );
        await assertCardSectionLimits(profile.id, card.id, sectionRows);
        await setCardSections(card.id, sectionRows);
      }
      res.status(201).json({ card });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesCustomerRoutes.get(
  "/collector/cards",
  requireActiveAuth,
  requireCollectorProfilesEnabled,
  async (req, res) => {
    try {
      const profile = await getProfileByUserId(req.user!.id);
      if (!profile) throw new CollectorProfileError("COLLECTOR_NOT_FOUND", "No profile yet.", 404);
      const cards = await listCardsForProfile(profile.id);
      res.json({ cards });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesCustomerRoutes.get(
  "/collector/cards/:publicCardId",
  requireActiveAuth,
  requireCollectorProfilesEnabled,
  async (req, res) => {
    try {
      const card = await getCardByPublicId(req.params.publicCardId!);
      if (!card) throw new CollectorProfileError("COLLECTOR_CARD_NOT_FOUND", "Card not found.", 404);
      assertCardOwner(card, req.user!.id);
      const [sections, images, gradeLinks] = await Promise.all([
        getCardSections(card.id),
        listCardImages(card.id),
        getGradeLinks(card.id),
      ]);
      res.json({ card, sections, images, gradeLinks });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesCustomerRoutes.patch(
  "/collector/cards/:publicCardId",
  requireActiveAuth,
  requireCollectorProfilesEnabled,
  async (req, res) => {
    try {
      const card = await getCardByPublicId(req.params.publicCardId!);
      if (!card) throw new CollectorProfileError("COLLECTOR_CARD_NOT_FOUND", "Card not found.", 404);
      assertCardOwner(card, req.user!.id);
      const updated = await updateCard(card.id, req.body ?? {});
      if (Array.isArray(req.body?.sections)) {
        const sectionRows = req.body.sections.map((s: string | Record<string, unknown>, idx: number) =>
          typeof s === "string"
            ? { section: s, display_order: idx }
            : { section: String(s.section), display_order: Number(s.display_order ?? idx) }
        );
        await assertCardSectionLimits(card.profile_id, card.id, sectionRows);
        await setCardSections(card.id, sectionRows);
      }
      res.json({ card: updated });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesCustomerRoutes.delete(
  "/collector/cards/:publicCardId",
  requireActiveAuth,
  requireCollectorProfilesEnabled,
  async (req, res) => {
    try {
      const card = await getCardByPublicId(req.params.publicCardId!);
      if (!card) throw new CollectorProfileError("COLLECTOR_CARD_NOT_FOUND", "Card not found.", 404);
      assertCardOwner(card, req.user!.id);
      await softDeleteCard(card.id);
      res.json({ ok: true });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesCustomerRoutes.post(
  "/collector/cards/:publicCardId/images",
  requireActiveAuth,
  requireCollectorProfilesEnabled,
  upload.single("image"),
  async (req, res) => {
    try {
      const card = await getCardByPublicId(req.params.publicCardId!);
      if (!card) throw new CollectorProfileError("COLLECTOR_CARD_NOT_FOUND", "Card not found.", 404);
      assertCardOwner(card, req.user!.id);
      const file = req.file;
      if (!file) throw new CollectorProfileError("COLLECTOR_INVALID_INPUT", "Image required.", 400);
      const role = String(req.body?.role ?? "front");
      const uploaded = await uploadCardOriginal({
        profileId: card.profile_id,
        cardId: card.id,
        role,
        buffer: file.buffer,
        declaredMime: file.mimetype,
      });
      const image = await upsertCardImage(card.id, role, {
        original_storage_id: uploaded.key,
        source_storage_id: uploaded.key,
        mime_type: uploaded.mime,
        size_bytes: uploaded.size,
        checksum: uploaded.checksum,
        processing_status: "uploaded",
        confirmed_by_user: false,
      });
      res.status(201).json({ image });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesCustomerRoutes.post(
  "/collector/cards/:publicCardId/process",
  requireActiveAuth,
  requireCollectorProfilesEnabled,
  async (req, res) => {
    try {
      const card = await getCardByPublicId(req.params.publicCardId!);
      if (!card) throw new CollectorProfileError("COLLECTOR_CARD_NOT_FOUND", "Card not found.", 404);
      assertCardOwner(card, req.user!.id);
      const role = String(req.body?.role ?? "front");
      const image = await upsertCardImage(card.id, role, { processing_status: "processing" });
      const buf = await loadImageBuffer(image.original_storage_id);
      if (!buf) throw new CollectorProfileError("COLLECTOR_INVALID_INPUT", "Original missing.", 400);
      const crop = await detectCardBoundary({
        buffer: buf,
        filename: `${role}.jpg`,
        userId: req.user!.id,
      });
      const processedKey = await putPublicDerivative({
        profileId: card.profile_id,
        cardId: card.id,
        role: `processed-${role}`,
        buffer: crop.pngBuffer,
        mime: "image/png",
      });
      const updated = await upsertCardImage(card.id, role, {
        processed_storage_id: processedKey,
        thumbnail_storage_id: processedKey,
        crop_data: crop.metadata,
        processing_status: crop.needsManual ? "requires_manual_crop" : "ready",
      });
      res.json({ image: updated, metadata: crop.metadata, needsManual: crop.needsManual });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

async function handleCropConfirm(req: Request, res: Response, role: "front" | "back") {
  const card = await getCardByPublicId(req.params.publicCardId!);
  if (!card) throw new CollectorProfileError("COLLECTOR_CARD_NOT_FOUND", "Card not found.", 404);
  assertCardOwner(card, req.user!.id);
  const image = await upsertCardImage(card.id, role, { processing_status: "processing" });
  const buf = await loadImageBuffer(image.original_storage_id);
  if (!buf) throw new CollectorProfileError("COLLECTOR_INVALID_INPUT", "Original missing.", 400);
  const crop = await processCardImageCrop({
    buffer: buf,
    filename: `${role}.jpg`,
    userId: req.user!.id,
    params: req.body?.crop ?? req.body?.params,
  });
  const processedKey = await putPublicDerivative({
    profileId: card.profile_id,
    cardId: card.id,
    role: `processed-${role}`,
    buffer: crop.pngBuffer,
    mime: "image/png",
  });
  const updated = await upsertCardImage(card.id, role, {
    processed_storage_id: processedKey,
    thumbnail_storage_id: processedKey,
    crop_data: req.body?.crop ?? crop.metadata,
    processing_status: "ready",
    confirmed_by_user: Boolean(req.body?.confirm ?? true),
  });
  res.json({ image: updated });
}

collectorProfilesCustomerRoutes.post(
  "/collector/cards/:publicCardId/crop/front",
  requireActiveAuth,
  requireCollectorProfilesEnabled,
  async (req, res) => {
    try {
      await handleCropConfirm(req, res, "front");
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesCustomerRoutes.post(
  "/collector/cards/:publicCardId/crop/back",
  requireActiveAuth,
  requireCollectorProfilesEnabled,
  async (req, res) => {
    try {
      await handleCropConfirm(req, res, "back");
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesCustomerRoutes.post(
  "/collector/cards/:publicCardId/publish",
  requireActiveAuth,
  requireCollectorProfilesEnabled,
  async (req, res) => {
    try {
      const card = await getCardByPublicId(req.params.publicCardId!);
      if (!card) throw new CollectorProfileError("COLLECTOR_CARD_NOT_FOUND", "Card not found.", 404);
      assertCardOwner(card, req.user!.id);
      const published = await publishCard(card.id);
      res.json({ card: published });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesCustomerRoutes.post(
  "/collector/cards/:publicCardId/unpublish",
  requireActiveAuth,
  requireCollectorProfilesEnabled,
  async (req, res) => {
    try {
      const card = await getCardByPublicId(req.params.publicCardId!);
      if (!card) throw new CollectorProfileError("COLLECTOR_CARD_NOT_FOUND", "Card not found.", 404);
      assertCardOwner(card, req.user!.id);
      const updated = await updateCard(card.id, { status: "hidden" });
      res.json({ card: updated });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesCustomerRoutes.post(
  "/collector/cards/:publicCardId/grade/options",
  requireActiveAuth,
  requireCollectorProfilesEnabled,
  requireCollectorGradingEnabled,
  async (req, res) => {
    try {
      const options = await getAvailableEntitlements(req.user!.id, req.user!.role);
      res.json({ options });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesCustomerRoutes.post(
  "/collector/cards/:publicCardId/grade/reserve-entitlement",
  requireActiveAuth,
  requireCollectorProfilesEnabled,
  requireCollectorGradingEnabled,
  async (req, res) => {
    try {
      const card = await getCardByPublicId(req.params.publicCardId!);
      if (!card) throw new CollectorProfileError("COLLECTOR_CARD_NOT_FOUND", "Card not found.", 404);
      await assertCanInitiateGrade({ card, viewerUserId: req.user!.id });
      const type = String(req.body?.entitlementType ?? req.body?.entitlement_type ?? "subscription");
      const reservation = await reserveEntitlement({
        userId: req.user!.id,
        cardId: card.id,
        entitlementType: type as "subscription" | "credit" | "promotional" | "one_off",
      });
      res.json(reservation);
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesCustomerRoutes.post(
  "/collector/cards/:publicCardId/grade/checkout",
  requireActiveAuth,
  requireCollectorProfilesEnabled,
  requireCollectorGradingEnabled,
  async (req, res) => {
    try {
      if (!isStripeConfigured()) {
        throw new CollectorProfileError("COLLECTOR_PAYMENT_REQUIRED", "Billing not configured.", 503);
      }
      const card = await getCardByPublicId(req.params.publicCardId!);
      if (!card) throw new CollectorProfileError("COLLECTOR_CARD_NOT_FOUND", "Card not found.", 404);
      await assertCanInitiateGrade({ card, viewerUserId: req.user!.id });
      const reservationId = String(req.body?.reservationId ?? req.body?.reservation_id ?? "");
      const customerId = await getOrCreateStripeCustomer(req.user!.id, req.user!.email);
      const checkout = await createCollectorGradeCheckout({
        userId: req.user!.id,
        userEmail: req.user!.email,
        cardId: card.id,
        cardPublicId: card.public_id,
        reservationId,
        origin: publicOrigin(req),
        customerId,
      });
      res.json(checkout);
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesCustomerRoutes.post(
  "/collector/cards/:publicCardId/grade/create-order",
  requireActiveAuth,
  requireCollectorProfilesEnabled,
  requireCollectorGradingEnabled,
  async (req, res) => {
    try {
      const card = await getCardByPublicId(req.params.publicCardId!);
      if (!card) throw new CollectorProfileError("COLLECTOR_CARD_NOT_FOUND", "Card not found.", 404);
      const { isOwner } = await assertCanInitiateGrade({ card, viewerUserId: req.user!.id });
      const images = await listCardImages(card.id);
      const front = images.find((i) => i.image_role === "front");
      const back = images.find((i) => i.image_role === "back");
      const frontBuf = await loadImageBuffer(
        front?.processed_storage_id ?? front?.original_storage_id ?? null
      );
      if (!frontBuf) throw new CollectorProfileError("COLLECTOR_INVALID_INPUT", "Front image required.", 400);
      const backBuf = back
        ? await loadImageBuffer(back.processed_storage_id ?? back.original_storage_id ?? null)
        : undefined;

      const reservationId = req.body?.reservationId ?? req.body?.reservation_id;
      if (reservationId) {
        await consumeReservedEntitlement(String(reservationId), req.user!.id, card.id, 0);
      }

      const grade = await gradeFromBuffers({
        userId: req.user!.id,
        role: req.user!.role,
        actorEmail: req.user!.email,
        front: frontBuf,
        back: backBuf ?? undefined,
      });
      const usageId = await getLatestUsageEventId(req.user!.id);
      const link = await insertGradeLink({
        cardId: card.id,
        initiatedByUserId: req.user!.id,
        relationshipType: isOwner ? "owner_initiated" : "viewer_initiated",
        gradingOrderId: usageId,
        publicationStatus: isOwner ? "private" : "ineligible_for_owner_publication",
        frontImageVersion: front?.id ?? null,
        backImageVersion: back?.id ?? null,
      });
      res.json({ grade: grade.result, gradeLink: link, viewerNotice: isOwner ? undefined : "This grade is for your account only and does not change the owner's listing." });
    } catch (err) {
      if (req.body?.reservationId) {
        await releaseReservation(String(req.body.reservationId)).catch(() => {});
      }
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesCustomerRoutes.post(
  "/collector/cards/:publicCardId/grades/:gradeLinkId/publish",
  requireActiveAuth,
  requireCollectorProfilesEnabled,
  requireCollectorGradingEnabled,
  async (req, res) => {
    try {
      const card = await getCardByPublicId(req.params.publicCardId!);
      if (!card) throw new CollectorProfileError("COLLECTOR_CARD_NOT_FOUND", "Card not found.", 404);
      assertCardOwner(card, req.user!.id);
      const status = String(req.body?.publicationStatus ?? req.body?.publication_status ?? "public_summary");
      await publishGradeLink(card.id, req.params.gradeLinkId!, status);
      res.json({ ok: true });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesCustomerRoutes.post(
  "/collector/cards/:publicCardId/report",
  requireActiveAuth,
  requireCollectorProfilesEnabled,
  async (req, res) => {
    try {
      const report = await createReport({
        reporterUserId: req.user!.id,
        entityType: "card",
        entityId: req.params.publicCardId!,
        reasonCode: String(req.body?.reasonCode ?? "other"),
        description: req.body?.description,
      });
      res.status(201).json({ report });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesPublicRoutes.get(
  "/collector/discover",
  optionalAuth,
  requireCollectorProfilesEnabled,
  async (req, res) => {
    try {
      const settings = await getCollectorProfileSettings();
      if (!settings.collector_profile_discovery_enabled) {
        res.status(404).json({ error: "Not found." });
        return;
      }
      const query = typeof req.query.q === "string" ? req.query.q : "";
      const profiles = await listDiscoverableProfiles({ query, limit: 50 });
      res.json({
        profiles: profiles.map((p) => ({
          username: p.username,
          displayName: p.display_name,
          locationRegion: p.location_region,
        })),
      });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

// Public card view (optional auth)
collectorProfilesPublicRoutes.get(
  "/collector/profiles/:username/cards/:publicCardId",
  optionalAuth,
  requireCollectorProfilesEnabled,
  async (req, res) => {
    try {
      const view = await buildPublicCardView({
        username: req.params.username!,
        publicCardId: req.params.publicCardId!,
        viewerUserId: req.user?.id,
      });
      res.json(view);
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

// Trade enquiries
collectorProfilesCustomerRoutes.post(
  "/collector/trade-enquiries",
  requireActiveAuth,
  requireCollectorProfilesEnabled,
  requireCollectorTradeEnabled,
  collectorRateLimit("trade", 20),
  async (req, res) => {
    try {
      const enquiry = await createTradeEnquiry({
        senderUserId: req.user!.id,
        recipientProfileId: String(req.body?.recipientProfileId ?? req.body?.recipient_profile_id),
        recipientUserId: String(req.body?.recipientUserId ?? req.body?.recipient_user_id),
        requestedCardIds: req.body?.requestedCardIds ?? req.body?.requested_card_ids ?? [],
        offeredCardIds: req.body?.offeredCardIds ?? req.body?.offered_card_ids ?? [],
        initialMessage: req.body?.message ?? req.body?.initial_message,
        cashDifferenceMinorUnits: req.body?.cashDifferenceMinorUnits,
        cashDifferenceCurrency: req.body?.cashDifferenceCurrency,
        fulfilmentPreference: req.body?.fulfilmentPreference,
        locationRegion: req.body?.locationRegion,
      });
      res.status(201).json({ enquiry });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesCustomerRoutes.get(
  "/collector/trade-enquiries",
  requireActiveAuth,
  requireCollectorProfilesEnabled,
  requireCollectorTradeEnabled,
  async (req, res) => {
    try {
      const enquiries = await listTradeEnquiries(req.user!.id);
      res.json({ enquiries });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesCustomerRoutes.get(
  "/collector/trade-enquiries/:publicId",
  requireActiveAuth,
  requireCollectorProfilesEnabled,
  requireCollectorTradeEnabled,
  async (req, res) => {
    try {
      const enquiry = await getTradeEnquiryByPublicId(req.params.publicId!);
      if (!enquiry) throw new CollectorProfileError("COLLECTOR_NOT_FOUND", "Not found.", 404);
      assertTradeEnquiryParticipant(enquiry, req.user!.id);
      res.json({ enquiry });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesCustomerRoutes.post(
  "/collector/trade-enquiries/:publicId/respond",
  requireActiveAuth,
  requireCollectorProfilesEnabled,
  requireCollectorTradeEnabled,
  async (req, res) => {
    try {
      const status = String(req.body?.status ?? "interested");
      const enquiry = await updateTradeEnquiryStatus(req.params.publicId!, status, req.user!.id);
      res.json({ enquiry });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesCustomerRoutes.post(
  "/collector/trade-enquiries/:publicId/complete",
  requireActiveAuth,
  requireCollectorProfilesEnabled,
  requireCollectorTradeEnabled,
  async (req, res) => {
    try {
      const enquiry = await updateTradeEnquiryStatus(req.params.publicId!, "completed", req.user!.id);
      res.json({ enquiry });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesCustomerRoutes.post(
  "/collector/trade-enquiries/:publicId/cancel",
  requireActiveAuth,
  requireCollectorProfilesEnabled,
  requireCollectorTradeEnabled,
  async (req, res) => {
    try {
      const enquiry = await updateTradeEnquiryStatus(req.params.publicId!, "cancelled", req.user!.id);
      res.json({ enquiry });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesCustomerRoutes.post(
  "/collector/trade-enquiries/:publicId/report",
  requireActiveAuth,
  requireCollectorProfilesEnabled,
  async (req, res) => {
    try {
      const enquiry = await getTradeEnquiryByPublicId(req.params.publicId!);
      if (!enquiry) throw new CollectorProfileError("COLLECTOR_NOT_FOUND", "Not found.", 404);
      assertTradeEnquiryParticipant(enquiry, req.user!.id);
      const report = await createReport({
        reporterUserId: req.user!.id,
        reportedUserId:
          enquiry.sender_user_id === req.user!.id
            ? enquiry.recipient_user_id
            : enquiry.sender_user_id,
        entityType: "trade_enquiry",
        entityId: req.params.publicId!,
        reasonCode: String(req.body?.reasonCode ?? "other"),
        description: req.body?.description,
      });
      res.status(201).json({ report });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

// Messaging
collectorProfilesCustomerRoutes.get(
  "/collector/conversations",
  requireActiveAuth,
  requireCollectorProfilesEnabled,
  requireCollectorMessagingEnabled,
  async (req, res) => {
    try {
      const conversations = await listConversationsForUser(req.user!.id);
      res.json({ conversations });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesCustomerRoutes.post(
  "/collector/conversations",
  requireActiveAuth,
  requireCollectorProfilesEnabled,
  requireCollectorMessagingEnabled,
  collectorRateLimit("conversation", 10),
  async (req, res) => {
    try {
      const conv = await createConversation({
        createdByUserId: req.user!.id,
        otherUserId: String(req.body?.otherUserId ?? req.body?.other_user_id),
        initialMessage: req.body?.message,
        cardId: req.body?.cardId,
      });
      res.status(201).json({ conversation: conv });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesCustomerRoutes.get(
  "/collector/conversations/:publicId",
  requireActiveAuth,
  requireCollectorProfilesEnabled,
  requireCollectorMessagingEnabled,
  async (req, res) => {
    try {
      const conv = await getConversationByPublicId(req.params.publicId!);
      if (!conv) throw new CollectorProfileError("COLLECTOR_NOT_FOUND", "Not found.", 404);
      const participant = await getParticipant(conv.id, req.user!.id);
      if (!participant) throw new CollectorProfileError("COLLECTOR_FORBIDDEN", "Forbidden.", 403);
      const messages = await listMessages(conv.id, participant.id);
      res.json({ conversation: conv, messages });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesCustomerRoutes.post(
  "/collector/conversations/:publicId/messages",
  requireActiveAuth,
  requireCollectorProfilesEnabled,
  requireCollectorMessagingEnabled,
  collectorRateLimit("message", 30),
  async (req, res) => {
    try {
      const conv = await getConversationByPublicId(req.params.publicId!);
      if (!conv) throw new CollectorProfileError("COLLECTOR_NOT_FOUND", "Not found.", 404);
      if (conv.status === "frozen") {
        throw new CollectorProfileError("COLLECTOR_FORBIDDEN", "Conversation is frozen.", 403);
      }
      const participant = await getParticipant(conv.id, req.user!.id);
      if (!participant) throw new CollectorProfileError("COLLECTOR_FORBIDDEN", "Forbidden.", 403);
      const message = await sendMessage({
        conversationId: conv.id,
        senderParticipantId: participant.id,
        body: String(req.body?.body ?? ""),
        messageType: req.body?.messageType ?? "text",
        cardId: req.body?.cardId,
      });
      res.status(201).json({ message });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesCustomerRoutes.post(
  "/collector/conversations/:publicId/read",
  requireActiveAuth,
  requireCollectorProfilesEnabled,
  requireCollectorMessagingEnabled,
  async (req, res) => {
    try {
      const conv = await getConversationByPublicId(req.params.publicId!);
      if (!conv) throw new CollectorProfileError("COLLECTOR_NOT_FOUND", "Not found.", 404);
      const participant = await getParticipant(conv.id, req.user!.id);
      if (!participant) throw new CollectorProfileError("COLLECTOR_FORBIDDEN", "Forbidden.", 403);
      await markConversationRead(conv.id, participant.id, String(req.body?.messageId ?? req.body?.message_id));
      res.json({ ok: true });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesCustomerRoutes.post(
  "/collector/conversations/:publicId/mute",
  requireActiveAuth,
  requireCollectorProfilesEnabled,
  requireCollectorMessagingEnabled,
  async (req, res) => {
    try {
      const conv = await getConversationByPublicId(req.params.publicId!);
      if (!conv) throw new CollectorProfileError("COLLECTOR_NOT_FOUND", "Not found.", 404);
      const participant = await getParticipant(conv.id, req.user!.id);
      if (!participant) throw new CollectorProfileError("COLLECTOR_FORBIDDEN", "Forbidden.", 403);
      await setConversationMuted(participant.id, req.body?.muted !== false);
      res.json({ ok: true });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesCustomerRoutes.post(
  "/collector/conversations/:publicId/archive",
  requireActiveAuth,
  requireCollectorProfilesEnabled,
  requireCollectorMessagingEnabled,
  async (req, res) => {
    try {
      const conv = await getConversationByPublicId(req.params.publicId!);
      if (!conv) throw new CollectorProfileError("COLLECTOR_NOT_FOUND", "Not found.", 404);
      const participant = await getParticipant(conv.id, req.user!.id);
      if (!participant) throw new CollectorProfileError("COLLECTOR_FORBIDDEN", "Forbidden.", 403);
      await setConversationArchived(participant.id, req.body?.archived !== false);
      res.json({ ok: true });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesCustomerRoutes.post(
  "/collector/conversations/:publicId/report",
  requireActiveAuth,
  requireCollectorProfilesEnabled,
  async (req, res) => {
    try {
      const conv = await getConversationByPublicId(req.params.publicId!);
      if (!conv) throw new CollectorProfileError("COLLECTOR_NOT_FOUND", "Not found.", 404);
      const participant = await getParticipant(conv.id, req.user!.id);
      if (!participant) throw new CollectorProfileError("COLLECTOR_FORBIDDEN", "Forbidden.", 403);
      const report = await createReport({
        reporterUserId: req.user!.id,
        entityType: "conversation",
        entityId: conv.id,
        conversationId: conv.id,
        reasonCode: String(req.body?.reasonCode ?? "other"),
        description: req.body?.description,
      });
      res.status(201).json({ report });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesCustomerRoutes.post(
  "/collector/messages/:messageId/report",
  requireActiveAuth,
  requireCollectorProfilesEnabled,
  async (req, res) => {
    try {
      const message = await getMessageById(req.params.messageId!);
      if (!message) throw new CollectorProfileError("COLLECTOR_NOT_FOUND", "Message not found.", 404);
      const participant = await getParticipant(message.conversation_id, req.user!.id);
      if (!participant) throw new CollectorProfileError("COLLECTOR_FORBIDDEN", "Forbidden.", 403);
      const report = await createReport({
        reporterUserId: req.user!.id,
        entityType: "message",
        entityId: req.params.messageId!,
        messageId: req.params.messageId!,
        conversationId: message.conversation_id,
        reasonCode: String(req.body?.reasonCode ?? "other"),
        description: req.body?.description,
      });
      res.status(201).json({ report });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

// Blocking
collectorProfilesCustomerRoutes.post(
  "/collector/users/:userId/block",
  requireActiveAuth,
  requireCollectorProfilesEnabled,
  async (req, res) => {
    try {
      await blockUser({
        blockingUserId: req.user!.id,
        blockedUserId: req.params.userId!,
        reason: req.body?.reason,
      });
      res.json({ ok: true });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesCustomerRoutes.delete(
  "/collector/users/:userId/block",
  requireActiveAuth,
  requireCollectorProfilesEnabled,
  async (req, res) => {
    try {
      await unblockUser(req.user!.id, req.params.userId!);
      res.json({ ok: true });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesCustomerRoutes.get(
  "/collector/blocks",
  requireActiveAuth,
  requireCollectorProfilesEnabled,
  async (req, res) => {
    try {
      const blocks = await listBlocks(req.user!.id);
      res.json({ blocks });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

// Profile image upload
collectorProfilesCustomerRoutes.post(
  "/collector/profile/me/image",
  requireActiveAuth,
  requireCollectorProfilesEnabled,
  upload.single("image"),
  async (req, res) => {
    try {
      const profile = await getProfileByUserId(req.user!.id);
      if (!profile) throw new CollectorProfileError("COLLECTOR_NOT_FOUND", "No profile yet.", 404);
      const file = req.file;
      if (!file) throw new CollectorProfileError("COLLECTOR_INVALID_INPUT", "Image required.", 400);
      const role = req.body?.role === "cover" ? "cover" : "profile";
      const key = await uploadProfileImage({
        profileId: profile.id,
        role,
        buffer: file.buffer,
        declaredMime: file.mimetype,
      });
      const patch =
        role === "cover"
          ? { cover_image_storage_id: key }
          : { profile_image_storage_id: key };
      const updated = await updateProfile(profile.id, patch);
      res.json({
        profile: updated,
        signedUrl: await getSignedStorageUrl(key),
      });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);
