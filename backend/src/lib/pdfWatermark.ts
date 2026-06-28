import type { jsPDF } from "jspdf";

export { shouldWatermarkCrop as shouldWatermarkFreeExports } from "./cropWatermark.js";

/** Free-plan stamp in the page footer margin — never over report content. */
export function applyPdfFreePlanWatermark(doc: jsPDF, logoDataUrl: string | null): void {
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    const footerBase = h - 6;

    if (logoDataUrl) {
      const gStateCtor = (doc as unknown as { GState?: new (opts: { opacity: number }) => unknown })
        .GState;
      if (gStateCtor && typeof doc.saveGraphicsState === "function") {
        doc.saveGraphicsState();
        doc.setGState(new gStateCtor({ opacity: 0.14 }) as never);
        const logoW = 24;
        const logoH = logoW * 0.31;
        doc.addImage(logoDataUrl, "PNG", 12, footerBase - logoH - 1, logoW, logoH);
        doc.restoreGraphicsState();
      }
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(130, 136, 148);
    doc.text("Free plan · gemcheck.co.uk", w - 12, footerBase, { align: "right" });
  }
}
