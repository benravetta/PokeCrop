import { Jimp } from "jimp";
import { resolveRect, type Rect } from "./cardRegions.js";
import { transcodeViaPython } from "../services/pythonBridge.js";

type JimpImage = Awaited<ReturnType<typeof Jimp.read>>;

export async function loadReportImage(
  buffer: Buffer,
  originalname?: string
): Promise<JimpImage | null> {
  try {
    return await Jimp.read(buffer);
  } catch {
    try {
      const jpeg = await transcodeViaPython(buffer, originalname || "image");
      return await Jimp.read(jpeg);
    } catch {
      return null;
    }
  }
}

export async function toPngDataUrl(
  img: JimpImage,
  max = 900
): Promise<{ url: string; w: number; h: number } | null> {
  if (!img.width || !img.height) return null;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const copy = img.clone();
  if (scale < 1) {
    await copy.scaleToFit({
      w: Math.max(1, Math.round(img.width * scale)),
      h: Math.max(1, Math.round(img.height * scale)),
    });
  }
  const url = await copy.getBase64("image/png");
  return { url, w: copy.width, h: copy.height };
}

export async function cropSnapshot(
  img: JimpImage,
  rect: Rect,
  outMax = 300
): Promise<string | null> {
  const sx = Math.max(0, Math.round(rect.x * img.width));
  const sy = Math.max(0, Math.round(rect.y * img.height));
  const sw = Math.max(1, Math.min(img.width - sx, Math.round(rect.w * img.width)));
  const sh = Math.max(1, Math.min(img.height - sy, Math.round(rect.h * img.height)));
  const cropped = img.clone().crop({ x: sx, y: sy, w: sw, h: sh });
  const scale = Math.min(1, outMax / Math.max(sw, sh));
  if (scale < 1) {
    await cropped.scaleToFit({
      w: Math.max(1, Math.round(sw * scale)),
      h: Math.max(1, Math.round(sh * scale)),
    });
  }
  return cropped.getBase64("image/png");
}

export { resolveRect };
