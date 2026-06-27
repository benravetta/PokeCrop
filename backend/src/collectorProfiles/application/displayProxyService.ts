import type { Response } from "express";
import { getObject } from "../../lib/r2.js";
import { getPlan } from "../../lib/usage.js";
import {
  getCardByPublicId,
  listCardImages,
  upsertCardImage,
  loadImageBuffer,
  type CollectorCardImageRow,
  type CollectorCardRow,
} from "../infrastructure/cardRepo.js";
import { buildDisplayDerivatives } from "../lib/displayDerivatives.js";
import { putPublicDerivative } from "../adapters/storageAdapter.js";
import { verifyDisplayToken } from "../lib/displayProxy.js";
import { CollectorProfileError } from "../domain/types.js";
import {
  canAnonymousViewCard,
  isProfilePubliclyAccessible,
  type CardVisibility,
  type ProfileVisibility,
} from "../domain/visibility.js";
import { getProfileById } from "../infrastructure/profileRepo.js";
import { isEitherBlocked } from "../infrastructure/blockRepo.js";

async function ensureDisplayDerivatives(opts: {
  card: CollectorCardRow;
  image: CollectorCardImageRow;
  viewerUserId?: string;
  viewerRole?: Parameters<typeof isAdminRole>[0];
}): Promise<CollectorCardImageRow> {
  if (opts.image.display_storage_id && opts.image.thumbnail_storage_id) {
    return opts.image;
  }
  if (!opts.image.processed_storage_id) return opts.image;

  const master = await loadImageBuffer(opts.image.processed_storage_id);
  if (!master) return opts.image;

  const userId = opts.card.owner_user_id;
  const plan = await getPlan(userId);
  const billing = plan === "free" ? "free" : "subscription";
  const { display, thumbnail } = await buildDisplayDerivatives({
    masterPng: master,
    role: null,
    plan,
    billing,
  });

  const displayKey = await putPublicDerivative({
    profileId: opts.card.profile_id,
    cardId: opts.card.id,
    role: `display-${opts.image.image_role}`,
    buffer: display,
    mime: "image/jpeg",
  });
  const thumbKey = await putPublicDerivative({
    profileId: opts.card.profile_id,
    cardId: opts.card.id,
    role: `thumb-${opts.image.image_role}`,
    buffer: thumbnail,
    mime: "image/jpeg",
  });

  return upsertCardImage(opts.card.id, opts.image.image_role, {
    display_storage_id: displayKey,
    thumbnail_storage_id: thumbKey,
    is_public_derivative: true,
  });
}

export async function assertCanViewDisplayImage(opts: {
  card: CollectorCardRow;
  viewerUserId?: string;
}): Promise<void> {
  const isOwner = opts.viewerUserId === opts.card.owner_user_id;
  if (isOwner) return;

  const profile = await getProfileById(opts.card.profile_id);
  if (!profile) {
    throw new CollectorProfileError("COLLECTOR_NOT_FOUND", "Not found.", 404);
  }

  if (opts.viewerUserId && profile.user_id !== opts.viewerUserId) {
    if (await isEitherBlocked(profile.user_id, opts.viewerUserId)) {
      throw new CollectorProfileError("COLLECTOR_NOT_FOUND", "Not found.", 404);
    }
  }

  if (!isProfilePubliclyAccessible(profile.visibility as ProfileVisibility, profile.status)) {
    throw new CollectorProfileError("COLLECTOR_NOT_FOUND", "Not found.", 404);
  }

  if (
    !canAnonymousViewCard(
      opts.card.visibility as CardVisibility,
      profile.visibility as ProfileVisibility,
      profile.status,
      opts.card.status
    )
  ) {
    throw new CollectorProfileError("COLLECTOR_NOT_FOUND", "Not found.", 404);
  }
}

export async function streamCollectorDisplayImage(opts: {
  publicCardId: string;
  role: string;
  size: "display" | "thumb";
  token: string;
  exp: number;
  viewerUserId?: string;
  viewerRole?: Parameters<typeof isAdminRole>[0];
  res: Response;
}): Promise<void> {
  if (
    !verifyDisplayToken({
      publicCardId: opts.publicCardId,
      role: opts.role,
      size: opts.size,
      token: opts.token,
      exp: opts.exp,
    })
  ) {
    opts.res.status(403).json({ error: "Invalid or expired image token." });
    return;
  }

  const card = await getCardByPublicId(opts.publicCardId);
  if (!card) {
    opts.res.status(404).json({ error: "Not found." });
    return;
  }

  await assertCanViewDisplayImage({ card, viewerUserId: opts.viewerUserId });

  const images = await listCardImages(card.id);
  let image = images.find((i) => i.image_role === opts.role);
  if (!image) {
    opts.res.status(404).json({ error: "Image not found." });
    return;
  }

  image = await ensureDisplayDerivatives({
    card,
    image,
    viewerUserId: opts.viewerUserId,
    viewerRole: opts.viewerRole,
  });

  const key =
    opts.size === "thumb"
      ? image.thumbnail_storage_id ?? image.display_storage_id
      : image.display_storage_id ?? image.thumbnail_storage_id;
  if (!key) {
    opts.res.status(404).json({ error: "Image not available." });
    return;
  }

  const obj = await getObject(key);
  if (!obj?.body) {
    opts.res.status(404).json({ error: "Image not found." });
    return;
  }

  opts.res.setHeader("Content-Type", "image/jpeg");
  opts.res.setHeader("Content-Disposition", "inline");
  opts.res.setHeader("Cache-Control", "private, no-store");
  opts.res.setHeader("X-Content-Type-Options", "nosniff");
  opts.res.send(obj.body);
}
