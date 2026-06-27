import { Jimp } from "jimp";
import { applyCropWatermark } from "../../lib/cropWatermark.js";
import type { UserRole } from "../../lib/adminAccess.js";
import type { Plan } from "../../lib/plans.js";
import { shouldWatermarkCrop } from "../../lib/cropWatermark.js";

const DISPLAY_MAX = 1200;
const THUMB_MAX = 400;

async function resizeLongEdge(buf: Buffer, maxEdge: number): Promise<Buffer> {
  const img = await Jimp.read(buf);
  const w = img.width ?? 0;
  const h = img.height ?? 0;
  if (!w || !h) return buf;
  const long = Math.max(w, h);
  if (long <= maxEdge) return buf;
  const scale = maxEdge / long;
  await img.scaleToFit({ w: Math.round(w * scale), h: Math.round(h * scale) });
  return Buffer.from(await img.getBuffer("image/jpeg"));
}

export async function buildDisplayDerivatives(opts: {
  masterPng: Buffer;
  role: UserRole | null | undefined;
  plan: Plan | null | undefined;
  billing: "free" | "subscription" | "one_off" | "admin";
}): Promise<{ display: Buffer; thumbnail: Buffer }> {
  let display = await resizeLongEdge(opts.masterPng, DISPLAY_MAX);
  let thumb = await resizeLongEdge(opts.masterPng, THUMB_MAX);

  if (
    shouldWatermarkCrop({
      role: opts.role ?? undefined,
      plan: opts.plan ?? undefined,
      billing: opts.billing === "admin" ? "free" : opts.billing,
    })
  ) {
    display = await applyCropWatermark(display);
    thumb = await applyCropWatermark(thumb);
  }

  return { display, thumbnail };
}
