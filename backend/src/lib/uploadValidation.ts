import fs from "fs";
import { ALLOWED_EXT, extFromMagic } from "./imageInput.js";

const GRADE_EXT = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".dng"];

async function readHead(filePath: string, len = 16): Promise<Buffer> {
  const head = Buffer.alloc(len);
  const fd = await fs.promises.open(filePath, "r");
  try {
    const { bytesRead } = await fd.read(head, 0, len, 0);
    return head.subarray(0, bytesRead);
  } finally {
    await fd.close().catch(() => {});
  }
}

/** Validate image bytes match an allowed type via magic-byte sniffing. */
export function validateImageBuffer(
  buf: Buffer,
  opts: { allowPdf?: boolean } = {}
): { ok: true; ext: string } | { ok: false; error: string } {
  if (!buf.length) return { ok: false, error: "Empty file." };
  const ext = extFromMagic(buf);
  if (!ext) {
    return {
      ok: false,
      error: "Could not detect a supported image type (JPEG, PNG, WEBP, PDF, HEIC, DNG).",
    };
  }
  const allowed = opts.allowPdf ? ALLOWED_EXT : GRADE_EXT;
  if (!allowed.includes(ext) && !(ext === ".heic" && allowed.includes(".heif"))) {
    return { ok: false, error: "Unsupported file type." };
  }
  return { ok: true, ext };
}

export async function validateImageAtPath(
  filePath: string,
  opts: { allowPdf?: boolean } = {}
): Promise<{ ok: true; ext: string } | { ok: false; error: string }> {
  try {
    const head = await readHead(filePath);
    return validateImageBuffer(head, opts);
  } catch {
    return { ok: false, error: "Could not read uploaded file." };
  }
}

export async function validateMulterFile(
  file: Express.Multer.File,
  opts: { allowPdf?: boolean } = {}
): Promise<{ ok: true } | { ok: false; error: string }> {
  const buf =
    file.buffer ??
    (file.path ? await readHead(file.path).catch(() => null) : null);
  if (!buf) return { ok: false, error: "Could not read uploaded file." };
  const sniffed = validateImageBuffer(buf, opts);
  if (!sniffed.ok) return sniffed;
  return { ok: true };
}

export async function validateMulterFiles(
  files: Express.Multer.File | Express.Multer.File[] | undefined,
  opts: { allowPdf?: boolean } = {}
): Promise<string | null> {
  if (!files) return null;
  const list = Array.isArray(files) ? files : [files];
  for (const file of list) {
    const result = await validateMulterFile(file, opts);
    if (!result.ok) return result.error;
  }
  return null;
}

export async function validateGradeFileMap(
  files: Record<string, Express.Multer.File[]> | undefined
): Promise<string | null> {
  if (!files) return null;
  for (const group of Object.values(files)) {
    const err = await validateMulterFiles(group, { allowPdf: false });
    if (err) return err;
  }
  return null;
}
