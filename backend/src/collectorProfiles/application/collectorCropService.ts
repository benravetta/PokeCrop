import type { Request, Response } from "express";
import {
  reserveCropQuota,
  releaseCropQuota,
  meterCropUsage,
  CropQuotaExceededError,
} from "../../lib/cropQuota.js";
import { getPlan } from "../../lib/usage.js";
import { isAdminRole } from "../../lib/adminAccess.js";
import { shouldWatermarkCrop } from "../../lib/cropWatermark.js";
import { applyCropWatermark } from "../../lib/cropWatermark.js";
import {
  previewCardImageCrop,
  processCardImageCrop,
} from "../adapters/cardProcessor.js";
import { putPublicDerivative } from "../adapters/storageAdapter.js";
import { buildDisplayDerivatives } from "../lib/displayDerivatives.js";
import { sanitizeOwnerImageView } from "../lib/cardImageView.js";
import {
  getCardByPublicId,
  listCardImages,
  upsertCardImage,
  loadImageBuffer,
} from "../infrastructure/cardRepo.js";
import { CollectorProfileError } from "../domain/types.js";
import { assertCardOwner } from "../infrastructure/cardRepo.js";

async function maybeWatermarkCollectorCrop(
  userId: string,
  role: Parameters<typeof isAdminRole>[0],
  buf: Buffer
): Promise<Buffer> {
  const plan = await getPlan(userId);
  if (!shouldWatermarkCrop({ role: role ?? undefined, plan, billing: plan === "free" ? "free" : "subscription" })) {
    return buf;
  }
  return applyCropWatermark(buf);
}

export async function handleCollectorProcess(
  req: Request,
  res: Response,
  role: "front" | "back"
): Promise<void> {
  const card = await getCardByPublicId(req.params.publicCardId!);
  if (!card) throw new CollectorProfileError("COLLECTOR_CARD_NOT_FOUND", "Card not found.", 404);
  assertCardOwner(card, req.user!.id);
  const images = await listCardImages(card.id);
  const existing = images.find((i) => i.image_role === role);
  const buf = await loadImageBuffer(existing?.original_storage_id ?? null);
  if (!buf) throw new CollectorProfileError("COLLECTOR_INVALID_INPUT", "Upload a photo first.", 400);

  const crop = await previewCardImageCrop({
    buffer: buf,
    filename: `${role}.jpg`,
    userId: req.user!.id,
    params: req.body?.params ?? req.body?.crop,
  });

  await upsertCardImage(card.id, role, {
    processing_status: crop.needsManual ? "requires_manual_crop" : "processing",
    crop_data: crop.metadata,
    confirmed_by_user: false,
  });

  res.json({
    metadata: crop.metadata,
    needsManual: crop.needsManual,
    previewBase64: crop.previewBase64,
    editImageJpeg: crop.editImageJpeg,
  });
}

export async function handleCropConfirm(
  req: Request,
  res: Response,
  role: "front" | "back"
): Promise<void> {
  const card = await getCardByPublicId(req.params.publicCardId!);
  if (!card) throw new CollectorProfileError("COLLECTOR_CARD_NOT_FOUND", "Card not found.", 404);
  assertCardOwner(card, req.user!.id);

  const images = await listCardImages(card.id);
  const existing = images.find((i) => i.image_role === role);
  const alreadyCounted = existing?.crop_usage_counted === true;

  let reserved: Awaited<ReturnType<typeof reserveCropQuota>> | null = null;
  if (!alreadyCounted) {
    reserved = await reserveCropQuota({ userId: req.user!.id, role: req.user!.role });
  }

  const buf = await loadImageBuffer(existing?.original_storage_id ?? null);
  if (!buf) {
    if (reserved?.incremented) await releaseCropQuota(req.user!.id);
    throw new CollectorProfileError("COLLECTOR_INVALID_INPUT", "Original missing.", 400);
  }

  try {
    const crop = await processCardImageCrop({
      buffer: buf,
      filename: `${role}.jpg`,
      userId: req.user!.id,
      params: req.body?.crop ?? req.body?.params,
    });

    const masterBuf = await maybeWatermarkCollectorCrop(req.user!.id, req.user!.role, crop.pngBuffer);
    const processedKey = await putPublicDerivative({
      profileId: card.profile_id,
      cardId: card.id,
      role: `processed-${role}`,
      buffer: masterBuf,
      mime: "image/png",
    });

    const plan = await getPlan(req.user!.id);
    const billing =
      isAdminRole(req.user!.role) ? "admin" : plan === "free" ? "free" : "subscription";
    const { display, thumbnail } = await buildDisplayDerivatives({
      masterPng: masterBuf,
      role: req.user!.role,
      plan,
      billing,
    });

    const displayKey = await putPublicDerivative({
      profileId: card.profile_id,
      cardId: card.id,
      role: `display-${role}`,
      buffer: display,
      mime: "image/jpeg",
    });
    const thumbKey = await putPublicDerivative({
      profileId: card.profile_id,
      cardId: card.id,
      role: `thumb-${role}`,
      buffer: thumbnail,
      mime: "image/jpeg",
    });

    const meta = crop.metadata as Record<string, unknown>;
    const width = typeof meta.width === "number" ? meta.width : null;
    const height = typeof meta.height === "number" ? meta.height : null;

    let cropUsage: Awaited<ReturnType<typeof meterCropUsage>> | null = null;
    if (!alreadyCounted && reserved) {
      cropUsage = await meterCropUsage({
        userId: req.user!.id,
        role: req.user!.role,
        summary: card.card_name,
        detail: { card_public_id: card.public_id, role, collector_profile: true },
        reserved,
      });
    }

    const updated = await upsertCardImage(card.id, role, {
      processed_storage_id: processedKey,
      display_storage_id: displayKey,
      thumbnail_storage_id: thumbKey,
      crop_data: req.body?.crop ?? crop.metadata,
      processing_status: "ready",
      confirmed_by_user: Boolean(req.body?.confirm ?? true),
      crop_usage_counted: true,
      width,
      height,
      is_public_derivative: true,
    });

    res.json({
      image: sanitizeOwnerImageView(updated, card.public_id),
      previewBase64: crop.previewBase64,
      metadata: crop.metadata,
      cropUsage: cropUsage
        ? {
            usedAfter: cropUsage.usedAfter,
            remainingAfter: cropUsage.remainingAfter,
            billing: cropUsage.billing,
          }
        : null,
    });
  } catch (err) {
    if (reserved?.incremented) await releaseCropQuota(req.user!.id);
    if (err instanceof CollectorProfileError) throw err;
    console.error("[collectorProfiles] crop confirm failed:", err);
    throw new CollectorProfileError(
      "COLLECTOR_CROP_FAILED",
      "Could not finish cropping this card.",
      422
    );
  }
}

export function sendCropQuotaError(res: Response, err: CropQuotaExceededError): void {
  res.status(err.status).json({
    error: err.message,
    error_code: err.code,
    plan: err.plan,
    remaining: err.remaining,
    limit: err.limit,
  });
}
