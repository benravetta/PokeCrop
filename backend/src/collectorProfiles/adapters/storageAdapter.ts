import { createHash } from "node:crypto";
import { putObject, signedGetUrl, isR2Configured } from "../../lib/r2.js";
import { CollectorProfileError } from "../domain/types.js";
import { getCollectorProfileSettings } from "../infrastructure/settingsRepo.js";

const ALLOWED_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export function sniffImageMime(buf: Buffer, declared: string): string | null {
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50) return "image/png";
  if (buf.slice(0, 4).toString("ascii") === "RIFF" && buf.slice(8, 12).toString("ascii") === "WEBP")
    return "image/webp";
  if (declared && ALLOWED_IMAGE_MIME.has(declared)) return declared;
  return null;
}

export async function uploadCollectorPrivateObject(opts: {
  key: string;
  buffer: Buffer;
  declaredMime: string;
  maxBytes: number;
}): Promise<{ key: string; mime: string; checksum: string; size: number }> {
  const mime = sniffImageMime(opts.buffer, opts.declaredMime);
  if (!mime || !ALLOWED_IMAGE_MIME.has(mime)) {
    throw new CollectorProfileError("COLLECTOR_INVALID_INPUT", "Unsupported file type.", 415);
  }
  if (opts.buffer.length > opts.maxBytes) {
    throw new CollectorProfileError("COLLECTOR_INVALID_INPUT", "File too large.", 413);
  }
  if (!isR2Configured()) {
    throw new CollectorProfileError("COLLECTOR_STORAGE_UNAVAILABLE", "Storage not configured.", 503);
  }
  await putObject(opts.key, opts.buffer, mime);
  return { key: opts.key, mime, checksum: sha256(opts.buffer), size: opts.buffer.length };
}

export async function uploadProfileImage(opts: {
  profileId: string;
  role: "profile" | "cover";
  buffer: Buffer;
  declaredMime: string;
}): Promise<string> {
  const settings = await getCollectorProfileSettings();
  const ext = opts.declaredMime.includes("png") ? "png" : "jpg";
  const key = `collector-profiles/${opts.profileId}/${opts.role}-${Date.now()}.${ext}`;
  const uploaded = await uploadCollectorPrivateObject({
    key,
    buffer: opts.buffer,
    declaredMime: opts.declaredMime,
    maxBytes: settings.max_profile_image_bytes,
  });
  return uploaded.key;
}

export async function uploadCardOriginal(opts: {
  profileId: string;
  cardId: string;
  role: string;
  buffer: Buffer;
  declaredMime: string;
}): Promise<{ key: string; mime: string; checksum: string; size: number }> {
  const settings = await getCollectorProfileSettings();
  const ext = declaredMimeToExt(opts.declaredMime);
  const key = `collector-profiles/${opts.profileId}/cards/${opts.cardId}/original-${opts.role}-${Date.now()}.${ext}`;
  return uploadCollectorPrivateObject({
    key,
    buffer: opts.buffer,
    declaredMime: opts.declaredMime,
    maxBytes: settings.max_card_image_bytes,
  });
}

function declaredMimeToExt(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}

export async function getSignedStorageUrl(key: string | null | undefined): Promise<string | null> {
  if (!key) return null;
  return signedGetUrl(key, 900);
}

export async function putPublicDerivative(opts: {
  profileId: string;
  cardId: string;
  role: string;
  buffer: Buffer;
  mime: string;
}): Promise<string> {
  const key = `collector-profiles/${opts.profileId}/cards/${opts.cardId}/public-${opts.role}-${Date.now()}.${opts.mime === "image/png" ? "png" : "jpg"}`;
  await uploadCollectorPrivateObject({
    key,
    buffer: opts.buffer,
    declaredMime: opts.mime,
    maxBytes: 15_728_640,
  });
  return key;
}
