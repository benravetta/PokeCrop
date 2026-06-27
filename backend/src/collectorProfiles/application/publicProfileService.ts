import {
  canAnonymousViewCard,
  isProfilePubliclyAccessible,
  shouldNoIndex,
  type CardVisibility,
  type ProfileVisibility,
} from "../domain/visibility.js";
import type { CollectorProfileRow } from "../domain/types.js";
import { isEitherBlocked } from "../infrastructure/blockRepo.js";
import {
  getProfileByUsername,
  getSectionOrder,
  listProfileInterests,
  listProfileLinks,
  resolveUsernameRedirect,
} from "../infrastructure/profileRepo.js";
import {
  getCardByPublicId,
  listCardsForProfile,
  listCardImages,
  type CollectorCardRow,
} from "../infrastructure/cardRepo.js";
import { getProfileById } from "../infrastructure/profileRepo.js";
import { CollectorProfileError } from "../domain/types.js";
import { displayPath } from "../lib/displayProxy.js";

function imageDisplayUrls(publicCardId: string, role: string) {
  return {
    display: displayPath({ publicCardId, role, size: "display" }),
    thumb: displayPath({ publicCardId, role, size: "thumb" }),
  };
}

function serializePublicCardFields(card: CollectorCardRow, isOwner: boolean) {
  const extra = card.identification_extra ?? {};
  const identifiers = Array.isArray(extra.identifiers)
    ? extra.identifiers.filter((x): x is string => typeof x === "string")
    : [];
  return {
    publicId: card.public_id,
    cardName: card.card_name,
    cardGame: card.card_game,
    setName: card.set_name,
    setCode: card.set_code,
    cardNumber: card.card_number,
    releaseYear: card.release_year,
    language: card.language,
    variant: card.variant,
    rarity: card.rarity,
    finishType: card.finish_type,
    edition: card.edition,
    condition: card.condition,
    tradeStatus: card.trade_status,
    cardState: card.card_state,
    officialGrade: card.official_grade,
    gradingCompany: card.grading_company,
    officialSubgrades: card.official_subgrades,
    certificationNumber: card.certification_number,
    publicDescription: card.public_description,
    tradeNotes: isOwner ? card.trade_notes : undefined,
    tradeValueMinorUnits: card.trade_value_minor_units,
    tradeValueCurrency: card.trade_value_currency,
    ownershipType: card.ownership_type,
    wantedNotes: isOwner ? card.wanted_notes : undefined,
    wantedPriority: isOwner ? card.wanted_priority : undefined,
    identificationConfidence: card.identification_confidence,
    identifiers,
    setTotal: typeof extra.set_total === "string" ? extra.set_total : null,
    illustrator: typeof extra.illustrator === "string" ? extra.illustrator : null,
    regulationMark: typeof extra.regulation_mark === "string" ? extra.regulation_mark : null,
  };
}

export async function buildPublicProfileView(opts: {
  username: string;
  viewerUserId?: string;
}) {
  const resolved = await resolveUsernameRedirect(opts.username);
  if (!resolved) {
    throw new CollectorProfileError("COLLECTOR_NOT_FOUND", "Profile not found.", 404);
  }
  const { profile, redirectedFrom } = resolved;

  if (opts.viewerUserId && profile.user_id !== opts.viewerUserId) {
    if (await isEitherBlocked(profile.user_id, opts.viewerUserId)) {
      throw new CollectorProfileError("COLLECTOR_NOT_FOUND", "Profile not found.", 404);
    }
  }

  const isOwner = opts.viewerUserId === profile.user_id;
  if (!isOwner && !isProfilePubliclyAccessible(profile.visibility as ProfileVisibility, profile.status)) {
    throw new CollectorProfileError("COLLECTOR_NOT_FOUND", "Profile not found.", 404);
  }

  const [interests, links, sections, showcase, forTrade, wanted] = await Promise.all([
    listProfileInterests(profile.id),
    listProfileLinks(profile.id),
    getSectionOrder(profile.id),
    listCardsForProfile(profile.id, { status: "active", section: "showcase" }),
    listCardsForProfile(profile.id, { status: "active", section: "for_trade" }),
    listCardsForProfile(profile.id, { status: "active", section: "wanted" }),
  ]);

  const visibleLinks = links.filter((l) => l.is_visible);

  const mapCard = async (card: Awaited<ReturnType<typeof listCardsForProfile>>[0]) => {
    if (
      !isOwner &&
      !canAnonymousViewCard(
        card.visibility as CardVisibility,
        profile.visibility as ProfileVisibility,
        profile.status,
        card.status
      )
    ) {
      return null;
    }
    const images = await listCardImages(card.id);
    const front = images.find((i) => i.image_role === "front");
    const hasDisplay = Boolean(front?.display_storage_id || front?.thumbnail_storage_id || front?.processed_storage_id);
    const thumb = hasDisplay ? imageDisplayUrls(card.public_id, "front").thumb : null;
    return {
      publicId: card.public_id,
      cardName: card.card_name,
      setName: card.set_name,
      cardNumber: card.card_number,
      rarity: card.rarity,
      tradeStatus: card.trade_status,
      cardState: card.card_state,
      officialGrade: card.official_grade,
      thumbnailUrl: thumb,
    };
  };

  const [showcaseCards, tradeCards, wantedCards] = await Promise.all([
    Promise.all(showcase.map(mapCard)),
    Promise.all(forTrade.map(mapCard)),
    Promise.all(wanted.map(mapCard)),
  ]);

  return {
    redirectUsername: redirectedFrom ? profile.username : null,
    profile: serializeProfile(profile, isOwner),
    interests,
    links: visibleLinks,
    sections,
    showcase: showcaseCards.filter(Boolean),
    forTrade: tradeCards.filter(Boolean),
    wanted: wantedCards.filter(Boolean),
    seo: {
      noIndex: shouldNoIndex(profile.visibility, profile.search_engine_indexing),
    },
  };
}

function serializeProfile(profile: CollectorProfileRow, isOwner: boolean) {
  return {
    username: profile.username,
    displayName: profile.display_name,
    bio: profile.bio,
    locationRegion: profile.location_region,
    countryCode: profile.country_code,
    accentSetting: profile.accent_setting,
    appearanceSetting: profile.appearance_setting,
    visibility: isOwner ? profile.visibility : undefined,
    tradeEnquiriesEnabled: profile.trade_enquiries_enabled,
    messagingEnabled: profile.messaging_enabled,
    allowViewerGrading: isOwner ? profile.allow_viewer_grading : undefined,
    status: isOwner ? profile.status : undefined,
    publishedAt: profile.published_at,
  };
}

export async function buildPublicCardView(opts: {
  username: string;
  publicCardId: string;
  viewerUserId?: string;
}) {
  const profile = await getProfileByUsername(opts.username);
  if (!profile) throw new CollectorProfileError("COLLECTOR_NOT_FOUND", "Card not found.", 404);

  if (opts.viewerUserId && profile.user_id !== opts.viewerUserId) {
    if (await isEitherBlocked(profile.user_id, opts.viewerUserId)) {
      throw new CollectorProfileError("COLLECTOR_NOT_FOUND", "Card not found.", 404);
    }
  }

  const isOwner = opts.viewerUserId === profile.user_id;
  if (!isOwner && !isProfilePubliclyAccessible(profile.visibility as ProfileVisibility, profile.status)) {
    throw new CollectorProfileError("COLLECTOR_NOT_FOUND", "Card not found.", 404);
  }

  const card = await getCardByPublicId(opts.publicCardId);
  if (!card || card.profile_id !== profile.id) {
    throw new CollectorProfileError("COLLECTOR_NOT_FOUND", "Card not found.", 404);
  }
  if (
    !isOwner &&
    !canAnonymousViewCard(
      card.visibility as CardVisibility,
      profile.visibility as ProfileVisibility,
      profile.status,
      card.status
    )
  ) {
    throw new CollectorProfileError("COLLECTOR_NOT_FOUND", "Card not found.", 404);
  }

  const images = await listCardImages(card.id);
  const front = images.find((i) => i.image_role === "front");
  const back = images.find((i) => i.image_role === "back");

  const frontUrls = front?.processed_storage_id || front?.display_storage_id
    ? imageDisplayUrls(card.public_id, "front")
    : null;
  const backUrls = back?.processed_storage_id || back?.display_storage_id
    ? imageDisplayUrls(card.public_id, "back")
    : null;

  return {
    profile: { username: profile.username, displayName: profile.display_name },
    card: serializePublicCardFields(card, isOwner),
    images: {
      frontDisplayUrl: frontUrls?.display ?? null,
      backDisplayUrl: backUrls?.display ?? null,
      frontThumbUrl: frontUrls?.thumb ?? null,
      backThumbUrl: backUrls?.thumb ?? null,
    },
    viewerGradingAllowed: resolveViewerGrading(profile, card),
    seo: { noIndex: shouldNoIndex(profile.visibility, profile.search_engine_indexing) },
  };
}

export function resolveViewerGrading(
  profile: CollectorProfileRow,
  card: { allow_viewer_grading_override: string }
): boolean {
  if (card.allow_viewer_grading_override === "allow") return true;
  if (card.allow_viewer_grading_override === "disallow") return false;
  return profile.allow_viewer_grading;
}

export async function assertCanInitiateGrade(opts: {
  card: CollectorCardRow;
  viewerUserId: string;
}): Promise<{ isOwner: boolean }> {
  const isOwner = opts.card.owner_user_id === opts.viewerUserId;
  if (isOwner) return { isOwner: true };

  const profile = await getProfileById(opts.card.profile_id);
  if (!profile) {
    throw new CollectorProfileError("COLLECTOR_NOT_FOUND", "Card not found.", 404);
  }

  if (await isEitherBlocked(profile.user_id, opts.viewerUserId)) {
    throw new CollectorProfileError("COLLECTOR_NOT_FOUND", "Card not found.", 404);
  }

  if (!isProfilePubliclyAccessible(profile.visibility as ProfileVisibility, profile.status)) {
    throw new CollectorProfileError("COLLECTOR_NOT_FOUND", "Card not found.", 404);
  }

  if (
    !canAnonymousViewCard(
      opts.card.visibility as CardVisibility,
      profile.visibility as ProfileVisibility,
      profile.status,
      opts.card.status
    )
  ) {
    throw new CollectorProfileError("COLLECTOR_NOT_FOUND", "Card not found.", 404);
  }

  if (!resolveViewerGrading(profile, opts.card)) {
    throw new CollectorProfileError(
      "COLLECTOR_FORBIDDEN",
      "Viewer grading is not allowed for this card.",
      403
    );
  }

  return { isOwner: false };
}

export function ownerImageDisplayPaths(publicCardId: string, role: string) {
  return imageDisplayUrls(publicCardId, role);
}
