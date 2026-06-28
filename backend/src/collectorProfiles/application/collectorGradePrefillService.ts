import {
  assertCardOwner,
  getCardByPublicId,
  listCardImages,
  loadImageBuffer,
} from "../infrastructure/cardRepo.js";
import { CollectorProfileError } from "../domain/types.js";

function slugFilename(name: string, role: string): string {
  const base = name.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "card";
  return `${base}-${role}.png`;
}

export async function getCollectorGradePrefill(opts: {
  publicCardId: string;
  userId: string;
}): Promise<{
  cardName: string;
  front: { base64: string; mime: "image/png"; filename: string };
  back?: { base64: string; mime: "image/png"; filename: string };
}> {
  const card = await getCardByPublicId(opts.publicCardId);
  if (!card) throw new CollectorProfileError("COLLECTOR_CARD_NOT_FOUND", "Card not found.", 404);
  assertCardOwner(card, opts.userId);

  const images = await listCardImages(card.id);
  const front = images.find((i) => i.image_role === "front");
  const back = images.find((i) => i.image_role === "back");

  const frontBuf = await loadImageBuffer(front?.processed_storage_id ?? null);
  if (!frontBuf) {
    throw new CollectorProfileError(
      "COLLECTOR_INVALID_INPUT",
      "Crop the front photo before running a pre-grade.",
      400
    );
  }

  const backBuf = back?.processed_storage_id
    ? await loadImageBuffer(back.processed_storage_id)
    : null;

  return {
    cardName: card.card_name,
    front: {
      base64: frontBuf.toString("base64"),
      mime: "image/png",
      filename: slugFilename(card.card_name, "front"),
    },
    back: backBuf
      ? {
          base64: backBuf.toString("base64"),
          mime: "image/png",
          filename: slugFilename(card.card_name, "back"),
        }
      : undefined,
  };
}
