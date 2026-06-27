import { createHash } from "node:crypto";
import { identifyCardRich, type RichCardIdentification } from "../../lib/identifyRich.js";
import {
  getCardByPublicId,
  listCardImages,
  updateCard,
  loadImageBuffer,
  type CollectorCardRow,
} from "../infrastructure/cardRepo.js";
import { CollectorProfileError } from "../domain/types.js";

const TCG_LABELS: Record<string, string> = {
  pokemon: "Pokémon",
  "one-piece": "One Piece",
  magic: "Magic: The Gathering",
  yugioh: "Yu-Gi-Oh!",
  lorcana: "Lorcana",
  digimon: "Digimon",
  sports: "Sports",
};

function gameLabel(tcg: string): string {
  return TCG_LABELS[tcg] ?? (tcg === "unidentified" ? "Pokémon" : tcg);
}

function cardNumberDisplay(id: RichCardIdentification): string | null {
  if (id.number && id.set_total) return `${id.number}/${id.set_total}`;
  return id.number || null;
}

function cropHash(processedKey: string | null | undefined): string | null {
  if (!processedKey) return null;
  return createHash("sha256").update(processedKey).digest("hex").slice(0, 32);
}

type CardWithIdMeta = CollectorCardRow & {
  identification_extra?: Record<string, unknown> | null;
  identification_confidence?: number | null;
  identified_at?: string | null;
};

export function mapIdentificationToCardPatch(
  id: RichCardIdentification
): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    identification_extra: {
      holo_type: id.holo_type || null,
      set_total: id.set_total || null,
      illustrator: id.illustrator || null,
      regulation_mark: id.regulation_mark || null,
      identifiers: id.identifiers,
      raw_tcg: id.tcg,
    },
    identification_confidence: id.confidence,
    identified_at: new Date().toISOString(),
    identification_source: "ai_rich",
  };
  if (id.name) patch.card_name = id.name;
  if (id.set) patch.set_name = id.set;
  if (id.set_code) patch.set_code = id.set_code;
  const num = cardNumberDisplay(id);
  if (num) patch.card_number = num;
  if (id.tcg) patch.card_game = gameLabel(id.tcg);
  if (id.rarity) patch.rarity = id.rarity;
  if (id.variant) patch.variant = id.variant;
  if (id.holo_type) patch.finish_type = id.holo_type;
  if (id.edition) patch.edition = id.edition;
  if (id.language) patch.language = id.language;
  if (id.release_year) patch.release_year = id.release_year;
  return patch;
}

export async function identifyCollectorCard(opts: {
  card: CollectorCardRow;
  role: "front" | "back";
  force?: boolean;
}): Promise<{
  identification: RichCardIdentification | null;
  appliedFields: string[];
  confidence: number | null;
}> {
  const card = opts.card as CardWithIdMeta;
  const images = await listCardImages(card.id);
  const img = images.find((i) => i.image_role === opts.role);
  if (!img?.processed_storage_id) {
    throw new CollectorProfileError("COLLECTOR_INVALID_INPUT", "Crop the photo before identifying.", 400);
  }

  const hash = cropHash(img.processed_storage_id);
  const storedHash =
    card.identification_extra && typeof card.identification_extra.crop_hash === "string"
      ? card.identification_extra.crop_hash
      : null;
  if (!opts.force && storedHash && hash && storedHash === hash && card.identified_at) {
    return {
      identification: null,
      appliedFields: [],
      confidence: card.identification_confidence ?? null,
    };
  }

  const buf = await loadImageBuffer(img.processed_storage_id);
  if (!buf) {
    throw new CollectorProfileError("COLLECTOR_INVALID_INPUT", "Processed image missing.", 400);
  }

  const identification = await identifyCardRich(buf, "image/png");
  if (!identification) {
    return { identification: null, appliedFields: [], confidence: null };
  }

  const patch = mapIdentificationToCardPatch(identification);
  if (hash) {
    (patch.identification_extra as Record<string, unknown>).crop_hash = hash;
  }

  if (opts.role === "back") {
    const conf = card.identification_confidence ?? 0;
    if (conf >= 0.75) {
      return { identification, appliedFields: [], confidence: conf };
    }
    const gapPatch: Record<string, unknown> = {};
    if (!card.card_name && patch.card_name) gapPatch.card_name = patch.card_name;
    if (!card.set_name && patch.set_name) gapPatch.set_name = patch.set_name;
    if (!card.card_number && patch.card_number) gapPatch.card_number = patch.card_number;
    if (Object.keys(gapPatch).length === 0) {
      return { identification, appliedFields: [], confidence: conf };
    }
    await updateCard(card.id, gapPatch);
    return {
      identification,
      appliedFields: Object.keys(gapPatch),
      confidence: identification.confidence,
    };
  }

  await updateCard(card.id, patch);
  return {
    identification,
    appliedFields: Object.keys(patch).filter(
      (k) => !["identification_extra", "identified_at", "identification_source"].includes(k)
    ),
    confidence: identification.confidence,
  };
}

export async function identifyCollectorCardByPublicId(opts: {
  publicCardId: string;
  userId: string;
  role: "front" | "back";
  force?: boolean;
}) {
  const card = await getCardByPublicId(opts.publicCardId);
  if (!card) throw new CollectorProfileError("COLLECTOR_CARD_NOT_FOUND", "Card not found.", 404);
  if (card.owner_user_id !== opts.userId) {
    throw new CollectorProfileError("COLLECTOR_FORBIDDEN", "Not your card.", 403);
  }
  return identifyCollectorCard({ card, role: opts.role, force: opts.force });
}
