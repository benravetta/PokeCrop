import { ownerImageDisplayPaths } from "../application/publicProfileService.js";
import type { CollectorCardImageRow } from "../infrastructure/cardRepo.js";

/** Owner-facing image payload — proxy URLs only, no internal storage keys. */
export function sanitizeOwnerImageView(img: CollectorCardImageRow, publicCardId: string) {
  const hasDisplay = Boolean(img.display_storage_id || img.processed_storage_id);
  const hasThumb = Boolean(
    img.thumbnail_storage_id || img.display_storage_id || img.processed_storage_id
  );
  return {
    id: img.id,
    card_id: img.card_id,
    image_role: img.image_role,
    source_type: img.source_type,
    mime_type: img.mime_type,
    size_bytes: img.size_bytes,
    width: img.width,
    height: img.height,
    crop_data: img.crop_data,
    processing_status: img.processing_status,
    confirmed_by_user: img.confirmed_by_user,
    crop_usage_counted: img.crop_usage_counted,
    displayUrl: hasDisplay ? ownerImageDisplayPaths(publicCardId, img.image_role).display : null,
    thumbUrl: hasThumb ? ownerImageDisplayPaths(publicCardId, img.image_role).thumb : null,
  };
}
