import type { jsPDF } from "jspdf";

export function applyPdfFreePlanWatermark(doc: jsPDF, logoDataUrl: string | null): void {
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();

    if (logoDataUrl) {
      const gStateCtor = (doc as unknown as { GState?: new (opts: { opacity: number }) => unknown })
        .GState;
      if (gStateCtor && typeof doc.saveGraphicsState === "function") {
        doc.saveGraphicsState();
        doc.setGState(new gStateCtor({ opacity: 0.1 }) as never);
        const logoW = w * 0.52;
        const logoH = logoW * 0.31;
        doc.addImage(logoDataUrl, "PNG", (w - logoW) / 2, (h - logoH) / 2, logoW, logoH);
        doc.restoreGraphicsState();
      }
    }

    doc.saveGraphicsState();
    doc.setTextColor(210, 214, 220);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(34);
    doc.text("GemCheck", w / 2, h / 2, { align: "center", angle: 32 });
    doc.restoreGraphicsState();

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(130, 136, 148);
    doc.text("Free plan · gemcheck.co.uk", w - 12, h - 6, { align: "right" });
  }
}
