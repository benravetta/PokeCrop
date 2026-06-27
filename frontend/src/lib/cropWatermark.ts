import { loadImage } from "./cardRegions";

export async function applyCropWatermarkToDataUrl(src: string): Promise<string> {
  try {
    const img = await loadImage(src);
    if (!img.naturalWidth || !img.naturalHeight) return src;

    const logo = await loadImage("/gemcheck-logo.png");
    if (!logo.naturalWidth || !logo.naturalHeight) return src;

    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return src;

    ctx.drawImage(img, 0, 0, w, h);

    const targetW = Math.max(80, Math.round(Math.min(w, h) * 0.45));
    const targetH = Math.round(targetW * 0.35);
    const mark = document.createElement("canvas");
    mark.width = targetW;
    mark.height = targetH;
    const mctx = mark.getContext("2d");
    if (!mctx) return src;

    mctx.drawImage(logo, 0, 0, targetW, targetH);
    ctx.save();
    ctx.globalAlpha = 0.17;
    ctx.translate(w / 2, h / 2);
    ctx.rotate((-32 * Math.PI) / 180);
    ctx.drawImage(mark, -targetW / 2, -targetH / 2, targetW, targetH);
    ctx.restore();

    return canvas.toDataURL("image/png");
  } catch {
    return src;
  }
}
