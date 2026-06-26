import fs from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { fetchRemoteImage, MAX_REMOTE_BYTES } from "./ssrf.js";

export const ALLOWED_EXT = [".jpg", ".jpeg", ".png", ".webp", ".pdf", ".heic", ".heif", ".dng"];
export const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "image/heic",
  "image/heif",
  "image/x-adobe-dng",
  "image/dng",
];

/** Sniff a sensible extension from magic bytes. */
export function extFromMagic(buf: Buffer): string {
  if (buf.length >= 4) {
    if (buf[0] === 0x89 && buf[1] === 0x50) return ".png";
    if (buf[0] === 0xff && buf[1] === 0xd8) return ".jpg";
    if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46)
      return ".pdf";
    if (
      buf.length >= 12 &&
      buf.toString("ascii", 0, 4) === "RIFF" &&
      buf.toString("ascii", 8, 12) === "WEBP"
    )
      return ".webp";
    if (buf.length >= 12 && buf.toString("ascii", 4, 8) === "ftyp") {
      const brand = buf.toString("ascii", 8, 12);
      if (["heic", "heix", "heif", "mif1", "msf1", "hevc"].includes(brand)) return ".heic";
    }
    if (
      (buf[0] === 0x49 && buf[1] === 0x49 && buf[2] === 0x2a && buf[3] === 0x00) ||
      (buf[0] === 0x4d && buf[1] === 0x4d && buf[2] === 0x00 && buf[3] === 0x2a)
    )
      return ".dng";
  }
  return "";
}

export function decodeBase64Image(input: string): Buffer | null {
  const m = input.match(/^data:[^;,]+;base64,(.*)$/s);
  const b64 = m ? m[1] : input;
  try {
    const buf = Buffer.from(b64, "base64");
    return buf.length > 0 ? buf : null;
  } catch {
    return null;
  }
}

export async function writeTempFile(buffer: Buffer, ext: string, tmpDir: string): Promise<string> {
  fs.mkdirSync(tmpDir, { recursive: true });
  const p = path.join(tmpDir, `${uuid()}${ext || ".bin"}`);
  await fs.promises.writeFile(p, buffer);
  return p;
}

export interface ResolvedImageInput {
  tempPath: string;
  filename: string;
  ownTemp: boolean;
}

/** Resolve an uploaded file, remote URL, or base64 payload to a temp path. */
export async function resolveImageInput(opts: {
  file?: Express.Multer.File;
  imageUrl?: string;
  imageBase64?: string;
  tmpDir: string;
}): Promise<ResolvedImageInput | { error: string; code: string }> {
  const { file, imageUrl, imageBase64, tmpDir } = opts;

  if (file) {
    const head = file.buffer
      ? file.buffer.subarray(0, Math.min(file.buffer.length, 16))
      : await (async () => {
          const fs = await import("fs");
          const fd = await fs.promises.open(file.path, "r");
          try {
            const head = Buffer.alloc(16);
            const { bytesRead } = await fd.read(head, 0, 16, 0);
            return head.subarray(0, bytesRead);
          } finally {
            await fd.close().catch(() => {});
          }
        })();
    const { validateImageBuffer } = await import("./uploadValidation.js");
    const sniff = validateImageBuffer(head, { allowPdf: true });
    if (!sniff.ok) {
      return { error: sniff.error, code: "unsupported_media_type" };
    }
    return {
      tempPath: file.path,
      filename: file.originalname || path.basename(file.path),
      ownTemp: true,
    };
  }

  if (imageUrl) {
    try {
      const remote = await fetchRemoteImage(imageUrl);
      const ext = path.extname(remote.filename) || extFromMagic(remote.buffer);
      const tempPath = await writeTempFile(remote.buffer, ext, tmpDir);
      return { tempPath, filename: remote.filename, ownTemp: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not fetch image URL.";
      return { error: message, code: "invalid_request" };
    }
  }

  if (imageBase64) {
    const buf = decodeBase64Image(imageBase64);
    if (!buf) return { error: "image_base64 is not valid base64.", code: "invalid_request" };
    if (buf.length > MAX_REMOTE_BYTES) {
      return { error: "Image exceeds the 50 MB limit.", code: "payload_too_large" };
    }
    const ext = extFromMagic(buf);
    if (!ext) {
      return {
        error: "Could not detect a supported image type (JPEG, PNG, WEBP, PDF, HEIC, DNG).",
        code: "unsupported_media_type",
      };
    }
    const tempPath = await writeTempFile(buf, ext, tmpDir);
    return { tempPath, filename: `image${ext}`, ownTemp: true };
  }

  return {
    error: "Provide an image via multipart 'image', or JSON 'image_url' or 'image_base64'.",
    code: "invalid_request",
  };
}

export function unlinkTemp(tempPath: string | null, ownTemp: boolean): void {
  if (tempPath && ownTemp) fs.unlink(tempPath, () => {});
}
