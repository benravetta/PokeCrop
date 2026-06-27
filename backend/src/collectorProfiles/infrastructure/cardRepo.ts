import { getServiceClient } from "../../lib/supabase.js";
import { CollectorProfileError, generatePublicId } from "../domain/types.js";
import { getCollectorProfileSettings } from "./settingsRepo.js";
import { getObject } from "../../lib/r2.js";

export interface CollectorCardRow {
  id: string;
  owner_user_id: string;
  profile_id: string;
  public_id: string;
  source_card_id: number | null;
  source_scan_id: number | null;
  source_ai_report_id: number | null;
  source_expert_report_id: string | null;
  card_game: string;
  card_name: string;
  set_name: string | null;
  set_code: string | null;
  card_number: string | null;
  release_year: number | null;
  language: string | null;
  variant: string | null;
  rarity: string | null;
  finish_type: string | null;
  edition: string | null;
  ownership_type: string;
  card_state: string;
  grading_company: string | null;
  official_grade: string | null;
  official_subgrades: Record<string, unknown> | null;
  certification_number: string | null;
  condition: string | null;
  quantity: number;
  trade_status: string;
  trade_value_minor_units: number | null;
  trade_value_currency: string | null;
  public_description: string | null;
  trade_notes: string | null;
  owner_private_notes: string | null;
  wanted_notes: string | null;
  wanted_priority: string | null;
  wanted_preferred_grader: string | null;
  wanted_min_grade: string | null;
  wanted_max_grade: string | null;
  wanted_min_condition: string | null;
  visibility: string;
  allow_viewer_grading_override: string;
  status: string;
  identification_extra: Record<string, unknown> | null;
  identification_confidence: number | null;
  identified_at: string | null;
  identification_source: string | null;
  created_at: string;
  updated_at: string;
}

export interface CollectorCardImageRow {
  id: string;
  card_id: string;
  image_role: string;
  source_type: string;
  source_storage_id: string | null;
  original_storage_id: string | null;
  processed_storage_id: string | null;
  display_storage_id: string | null;
  thumbnail_storage_id: string | null;
  crop_usage_counted: boolean;
  width: number | null;
  height: number | null;
  mime_type: string | null;
  size_bytes: number | null;
  checksum: string | null;
  crop_data: Record<string, unknown> | null;
  perspective_data: Record<string, unknown> | null;
  processing_status: string;
  confirmed_by_user: boolean;
  is_public_derivative: boolean;
}

export async function getCardByPublicId(publicId: string): Promise<CollectorCardRow | null> {
  const { data, error } = await getServiceClient()
    .from("collector_cards")
    .select("*")
    .eq("public_id", publicId)
    .maybeSingle();
  if (error) throw error;
  return data as CollectorCardRow | null;
}

export async function getCardById(id: string): Promise<CollectorCardRow | null> {
  const { data, error } = await getServiceClient()
    .from("collector_cards")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as CollectorCardRow | null;
}

export async function listCardsForProfile(
  profileId: string,
  opts?: { status?: string; section?: string }
): Promise<CollectorCardRow[]> {
  if (opts?.section) {
    const { data: sections, error: secErr } = await getServiceClient()
      .from("collector_card_sections")
      .select("card_id")
      .eq("section", opts.section);
    if (secErr) throw secErr;
    const ids = (sections ?? []).map((s) => s.card_id);
    if (ids.length === 0) return [];
    let q = getServiceClient().from("collector_cards").select("*").in("id", ids).eq("profile_id", profileId);
    if (opts.status) q = q.eq("status", opts.status);
    const { data, error } = await q.order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as CollectorCardRow[];
  }
  let q = getServiceClient().from("collector_cards").select("*").eq("profile_id", profileId);
  if (opts?.status) q = q.eq("status", opts.status);
  const { data, error } = await q.order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CollectorCardRow[];
}

export async function createCard(opts: {
  ownerUserId: string;
  profileId: string;
  patch: Record<string, unknown>;
}): Promise<CollectorCardRow> {
  const publicId = generatePublicId("cd");
  const { data, error } = await getServiceClient()
    .from("collector_cards")
    .insert({
      owner_user_id: opts.ownerUserId,
      profile_id: opts.profileId,
      public_id: publicId,
      card_game: String(opts.patch.card_game ?? "Pokemon"),
      card_name: String(opts.patch.card_name ?? "Untitled card"),
      set_name: opts.patch.set_name ?? null,
      set_code: opts.patch.set_code ?? null,
      card_number: opts.patch.card_number ?? null,
      release_year: opts.patch.release_year ?? null,
      language: opts.patch.language ?? null,
      variant: opts.patch.variant ?? null,
      rarity: opts.patch.rarity ?? null,
      finish_type: opts.patch.finish_type ?? null,
      edition: opts.patch.edition ?? null,
      ownership_type: opts.patch.ownership_type ?? "owned",
      card_state: opts.patch.card_state ?? "raw",
      grading_company: opts.patch.grading_company ?? null,
      official_grade: opts.patch.official_grade ?? null,
      official_subgrades: opts.patch.official_subgrades ?? null,
      certification_number: opts.patch.certification_number ?? null,
      condition: opts.patch.condition ?? null,
      quantity: opts.patch.quantity ?? 1,
      trade_status: opts.patch.trade_status ?? "not_available",
      trade_value_minor_units: opts.patch.trade_value_minor_units ?? null,
      trade_value_currency: opts.patch.trade_value_currency ?? null,
      public_description: opts.patch.public_description ?? null,
      trade_notes: opts.patch.trade_notes ?? null,
      owner_private_notes: opts.patch.owner_private_notes ?? null,
      wanted_notes: opts.patch.wanted_notes ?? null,
      wanted_priority: opts.patch.wanted_priority ?? null,
      visibility: opts.patch.visibility ?? "public",
      allow_viewer_grading_override:
        opts.patch.allow_viewer_grading_override ?? "inherit_profile_setting",
      status: "draft",
      source_card_id: opts.patch.source_card_id ?? null,
      source_scan_id: opts.patch.source_scan_id ?? null,
      source_ai_report_id: opts.patch.source_ai_report_id ?? null,
      source_expert_report_id: opts.patch.source_expert_report_id ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as CollectorCardRow;
}

export async function updateCard(cardId: string, patch: Record<string, unknown>): Promise<CollectorCardRow> {
  const allowed = [
    "card_game",
    "card_name",
    "set_name",
    "set_code",
    "card_number",
    "release_year",
    "language",
    "variant",
    "rarity",
    "finish_type",
    "edition",
    "ownership_type",
    "card_state",
    "grading_company",
    "official_grade",
    "official_subgrades",
    "certification_number",
    "condition",
    "quantity",
    "trade_status",
    "trade_value_minor_units",
    "trade_value_currency",
    "public_description",
    "trade_notes",
    "owner_private_notes",
    "wanted_notes",
    "wanted_priority",
    "wanted_preferred_grader",
    "wanted_min_grade",
    "wanted_max_grade",
    "wanted_min_condition",
    "visibility",
    "allow_viewer_grading_override",
    "status",
    "identification_extra",
    "identification_confidence",
    "identified_at",
    "identification_source",
  ];
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of allowed) {
    if (patch[k] !== undefined) update[k] = patch[k];
  }
  const { data, error } = await getServiceClient()
    .from("collector_cards")
    .update(update)
    .eq("id", cardId)
    .select("*")
    .single();
  if (error) throw error;
  return data as CollectorCardRow;
}

export async function softDeleteCard(cardId: string): Promise<void> {
  await getServiceClient()
    .from("collector_cards")
    .update({ status: "deleted", updated_at: new Date().toISOString() })
    .eq("id", cardId);
}

export async function assertCardSectionLimits(
  profileId: string,
  cardId: string,
  sections: { section: string }[]
): Promise<void> {
  if (!sections.some((s) => s.section === "wanted")) return;

  const settings = await getCollectorProfileSettings();
  const profileCards = await listCardsForProfile(profileId);
  const otherCardIds = profileCards.map((c) => c.id).filter((id) => id !== cardId);
  if (otherCardIds.length === 0) return;

  const { data, error } = await getServiceClient()
    .from("collector_card_sections")
    .select("card_id")
    .eq("section", "wanted")
    .in("card_id", otherCardIds);
  if (error) throw error;
  if ((data ?? []).length >= settings.max_wanted_entries) {
    throw new CollectorProfileError(
      "COLLECTOR_INVALID_INPUT",
      `You can list at most ${settings.max_wanted_entries} wanted cards.`,
      400
    );
  }
}

export async function setCardSections(
  cardId: string,
  sections: { section: string; display_order: number }[]
): Promise<void> {
  await getServiceClient().from("collector_card_sections").delete().eq("card_id", cardId);
  if (sections.length === 0) return;
  const { error } = await getServiceClient().from("collector_card_sections").insert(
    sections.map((s) => ({ card_id: cardId, ...s }))
  );
  if (error) throw error;
}

export async function getCardSections(cardId: string): Promise<string[]> {
  const { data, error } = await getServiceClient()
    .from("collector_card_sections")
    .select("section")
    .eq("card_id", cardId);
  if (error) throw error;
  return (data ?? []).map((r) => r.section);
}

export async function getCardImageByRole(
  cardId: string,
  role: string
): Promise<CollectorCardImageRow | null> {
  const { data, error } = await getServiceClient()
    .from("collector_card_images")
    .select("*")
    .eq("card_id", cardId)
    .eq("image_role", role)
    .maybeSingle();
  if (error) throw error;
  return data as CollectorCardImageRow | null;
}

export async function upsertCardImage(
  cardId: string,
  role: string,
  patch: Partial<CollectorCardImageRow>
): Promise<CollectorCardImageRow> {
  const existing = await getCardImageByRole(cardId, role);
  if (existing) {
    const { data, error } = await getServiceClient()
      .from("collector_card_images")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw error;
    return data as CollectorCardImageRow;
  }
  const { data, error } = await getServiceClient()
    .from("collector_card_images")
    .insert({
      card_id: cardId,
      image_role: role,
      source_type: patch.source_type ?? "upload",
      ...patch,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as CollectorCardImageRow;
}

export async function listCardImages(cardId: string): Promise<CollectorCardImageRow[]> {
  const { data, error } = await getServiceClient()
    .from("collector_card_images")
    .select("*")
    .eq("card_id", cardId);
  if (error) throw error;
  return (data ?? []) as CollectorCardImageRow[];
}

export async function loadImageBuffer(storageKey: string | null): Promise<Buffer | null> {
  if (!storageKey) return null;
  try {
    const obj = await getObject(storageKey);
    return obj?.body ?? null;
  } catch {
    return null;
  }
}

export async function listCardsAdmin(opts: { limit?: number }): Promise<CollectorCardRow[]> {
  const { data, error } = await getServiceClient()
    .from("collector_cards")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 200);
  if (error) throw error;
  return (data ?? []) as CollectorCardRow[];
}

export function assertCardOwner(card: CollectorCardRow, userId: string): void {
  if (card.owner_user_id !== userId) {
    throw new CollectorProfileError("COLLECTOR_FORBIDDEN", "You cannot edit this card.", 403);
  }
}

export async function publishCard(cardId: string): Promise<CollectorCardRow> {
  const images = await listCardImages(cardId);
  const card = await getCardById(cardId);
  if (!card) throw new CollectorProfileError("COLLECTOR_CARD_NOT_FOUND", "Card not found.", 404);
  if (card.ownership_type === "owned") {
    const front = images.find((i) => i.image_role === "front");
    const back = images.find((i) => i.image_role === "back");
    if (!front?.confirmed_by_user || !back?.confirmed_by_user) {
      throw new CollectorProfileError(
        "COLLECTOR_INVALID_INPUT",
        "Confirm front and back crops before publishing.",
        400
      );
    }
  }
  const { data, error } = await getServiceClient()
    .from("collector_cards")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("id", cardId)
    .select("*")
    .single();
  if (error) throw error;
  return data as CollectorCardRow;
}

export async function insertGradeLink(opts: {
  cardId: string;
  initiatedByUserId: string;
  relationshipType: string;
  gradingOrderId?: number | null;
  publicationStatus?: string;
  frontImageVersion?: string | null;
  backImageVersion?: string | null;
}) {
  const { data, error } = await getServiceClient()
    .from("collector_card_grade_links")
    .insert({
      card_id: opts.cardId,
      initiated_by_user_id: opts.initiatedByUserId,
      relationship_type: opts.relationshipType,
      grading_order_id: opts.gradingOrderId ?? null,
      publication_status: opts.publicationStatus ?? "private",
      source_front_image_version: opts.frontImageVersion ?? null,
      source_back_image_version: opts.backImageVersion ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

const OWNER_PUBLISHABLE_STATUSES = new Set([
  "private",
  "owner_visible",
  "public_summary",
  "public_full_report",
]);

export async function publishGradeLink(
  cardId: string,
  gradeLinkId: string,
  publicationStatus: string
): Promise<void> {
  if (!OWNER_PUBLISHABLE_STATUSES.has(publicationStatus)) {
    throw new CollectorProfileError("COLLECTOR_INVALID_INPUT", "Invalid publication status.", 400);
  }

  const { data: link, error: fetchErr } = await getServiceClient()
    .from("collector_card_grade_links")
    .select("*")
    .eq("id", gradeLinkId)
    .eq("card_id", cardId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!link) {
    throw new CollectorProfileError("COLLECTOR_NOT_FOUND", "Grade link not found.", 404);
  }
  if (link.relationship_type === "viewer_initiated") {
    throw new CollectorProfileError(
      "COLLECTOR_FORBIDDEN",
      "Viewer-initiated grades cannot be published on your listing.",
      403
    );
  }
  if (link.publication_status === "ineligible_for_owner_publication") {
    throw new CollectorProfileError("COLLECTOR_FORBIDDEN", "This grade cannot be published.", 403);
  }

  await getServiceClient()
    .from("collector_card_grade_links")
    .update({
      publication_status: publicationStatus,
      published_by_owner_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", gradeLinkId)
    .eq("card_id", cardId);
}

export async function getGradeLinks(cardId: string) {
  const { data, error } = await getServiceClient()
    .from("collector_card_grade_links")
    .select("*")
    .eq("card_id", cardId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
