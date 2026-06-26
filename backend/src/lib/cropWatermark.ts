import fs from "fs";
import { Jimp } from "jimp";
import type { Plan } from "./plans.js";
import type { UsageBilling } from "./usageEvents.js";
import { isAdminRole, type UserRole } from "./adminAccess.js";
import { resolveAsset } from "./assetsPath.js";

let logoCache: Awaited<ReturnType<typeof Jimp.read>> | null = null;

async function watermarkLogo(): Promise<Awaited<ReturnType<typeof Jimp.read>> | null> {
  if (logoCache) return logoCache;
  try {
    logoCache = await Jimp.read(fs.readFileSync(resolveAsset("gemcheck-logo.png")));
    return logoCache;
  } catch {
    return null;
  }
}

export function shouldWatermarkCrop(opts: {
  role?: UserRole | null;
  plan?: Plan | null;
  billing?: UsageBilling | null;
}): boolean {
  if (isAdminRole(opts.role)) return false;
  if (opts.billing && opts.billing !== "free") return false;
  if (opts.plan && opts.plan !== "free") return false;
  return true;
}

export async function applyCropWatermark(pngBuffer: Buffer): Promise<Buffer> {
  const img = await Jimp.read(pngBuffer);
  const w = img.width;
  const h = img.height;
  if (!w || !h) return pngBuffer;

  const logo = await watermarkLogo();
  if (!logo?.width || !logo.height) return pngBuffer;

  const targetW = Math.max(80, Math.round(Math.min(w, h) * 0.45));
  const mark = logo.clone();
  await mark.scaleToFit({ w: targetW, h: Math.round(targetW * 0.35) });
  mark.opacity(0.17);
  mark.rotate({ deg: -32 });

  const cx = Math.round((w - mark.width) / 2);
  const cy = Math.round((h - mark.height) / 2);
  img.composite(mark, cx, cy);

  return Buffer.from(await img.getBuffer("image/png"));
}
