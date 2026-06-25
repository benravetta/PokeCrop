import { createHash } from "node:crypto";
import { putObject, signedGetUrl, isR2Configured } from "../../lib/r2.js";
import { getServiceClient } from "../../lib/supabase.js";
import { HumanPregradeError } from "../domain/types.js";
import { getHumanPregradeSettings } from "../infrastructure/settingsRepo.js";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
]);

export function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export function sniffMime(buf: Buffer, declared: string): string | null {
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50) return "image/png";
  if (buf.slice(0, 4).toString("ascii") === "RIFF" && buf.slice(8, 12).toString("ascii") === "WEBP")
    return "image/webp";
  if (buf.slice(4, 8).toString("ascii") === "ftyp") return "video/mp4";
  if (declared && ALLOWED_MIME.has(declared)) return declared;
  return null;
}

export async function uploadHumanPregradeImage(opts: {
  orderId: string;
  userId: string;
  imageType: string;
  filename: string;
  buffer: Buffer;
  declaredMime: string;
  caption?: string;
}): Promise<{ id: string; signedUrl: string | null }> {
  const settings = await getHumanPregradeSettings();
  const mime = sniffMime(opts.buffer, opts.declaredMime);
  if (!mime || !ALLOWED_MIME.has(mime)) {
    throw new HumanPregradeError("HUMAN_PREGRADE_INVALID_IMAGE", "Unsupported file type", 415);
  }
  const isVideo = mime.startsWith("video/");
  const max = isVideo ? settings.max_video_bytes : settings.max_image_bytes;
  if (opts.buffer.length > max) {
    throw new HumanPregradeError("HUMAN_PREGRADE_INVALID_IMAGE", "File too large", 413);
  }
  if (!isR2Configured()) {
    throw new HumanPregradeError("HUMAN_PREGRADE_INVALID_IMAGE", "Storage not configured", 503);
  }

  const ext = mime === "image/jpeg" ? "jpg" : mime.split("/")[1] ?? "bin";
  const imageId = crypto.randomUUID();
  const key = `human-pregrade/${opts.orderId}/${imageId}.${ext}`;
  await putObject(key, opts.buffer, mime);

  const checksum = sha256(opts.buffer);
  const { data, error } = await getServiceClient()
    .from("human_pregrade_images")
    .insert({
      id: imageId,
      order_id: opts.orderId,
      image_type: opts.imageType,
      source_type: "human_pregrade_upload",
      storage_object_id: key,
      original_filename: opts.filename,
      mime_type: mime,
      size_bytes: opts.buffer.length,
      checksum,
      customer_caption: opts.caption ?? null,
      uploaded_by_user_id: opts.userId,
    })
    .select("id")
    .single();
  if (error) throw error;

  const signedUrl = await signedGetUrl(key, 900);
  return { id: String(data.id), signedUrl };
}

export async function linkExistingCropImage(opts: {
  orderId: string;
  userId: string;
  imageType: string;
  usageEventId: number;
}): Promise<{ id: string; signedUrl: string | null }> {
  const sb = getServiceClient();
  const { data: event, error: evErr } = await sb
    .from("usage_events")
    .select("id, kind, user_id, detail")
    .eq("id", opts.usageEventId)
    .eq("user_id", opts.userId)
    .maybeSingle();
  if (evErr) throw evErr;
  if (!event || event.kind !== "crop") {
    throw new HumanPregradeError("HUMAN_PREGRADE_NOT_FOUND", "Crop image not found", 404);
  }
  const hash =
    event.detail && typeof event.detail === "object"
      ? (event.detail as Record<string, unknown>).content_hash
      : null;
  if (typeof hash !== "string") {
    throw new HumanPregradeError("HUMAN_PREGRADE_NOT_FOUND", "No archived image for event", 404);
  }

  const { data: cat } = await sb
    .from("catalog_items")
    .select("r2_key, mime_type")
    .eq("content_hash", hash)
    .maybeSingle();
  if (!cat?.r2_key) {
    throw new HumanPregradeError("HUMAN_PREGRADE_NOT_FOUND", "Catalog image not found", 404);
  }

  const imageId = crypto.randomUUID();
  const { error } = await sb.from("human_pregrade_images").insert({
    id: imageId,
    order_id: opts.orderId,
    image_type: opts.imageType,
    source_type: "existing_upload",
    source_upload_id: opts.usageEventId,
    storage_object_id: String(cat.r2_key),
    mime_type: String(cat.mime_type ?? "image/png"),
    size_bytes: 0,
    checksum: hash,
    uploaded_by_user_id: opts.userId,
  });
  if (error) throw error;

  const signedUrl = await signedGetUrl(String(cat.r2_key), 900);
  return { id: imageId, signedUrl };
}

export async function getImageSignedUrl(storageKey: string): Promise<string | null> {
  return signedGetUrl(storageKey, 900);
}

export async function listOrderImages(orderId: string) {
  const { data, error } = await getServiceClient()
    .from("human_pregrade_images")
    .select("*")
    .eq("order_id", orderId)
    .eq("is_active", true)
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function orderHasMandatoryImages(
  orderId: string,
  mandatory: string[]
): Promise<boolean> {
  const images = await listOrderImages(orderId);
  const types = new Set(images.map((i) => String(i.image_type)));
  return mandatory.every((t) => types.has(t));
}
