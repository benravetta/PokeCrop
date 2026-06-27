// Builds a downloadable PDF condition report from a grade result, including the
// card images, per-company grades + subgrades, centering, value, inspection
// notes, and cropped snapshots of every located defect. Rendered client-side
// with jsPDF — the defect snapshots reuse the same region cropping the on-screen
// report uses, so the PDF matches what the user sees.

import { jsPDF } from "jspdf";
import { CENTRING_SECTION_TITLE } from "./displayLabels";
import { loadImage, cropFromImage, resolveRect } from "./cardRegions";
import { applyCropWatermarkToDataUrl } from "./cropWatermark";
import { applyPdfFreePlanWatermark } from "./pdfWatermark";
import type { GradeResult, Preparation, PrepItem, CardPricing } from "./api";

const asObj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const asStr = (v: unknown): string => (typeof v === "string" ? v : "");
const asArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asNum = (v: unknown): number | null => (typeof v === "number" ? v : null);

// Palette (RGB) — mirrors the dark-on-light print look.
const INK = [24, 27, 33] as const;
const MUTE = [110, 116, 128] as const;
const LINE = [221, 224, 230] as const;
const ACCENT = [37, 99, 235] as const;
const RED = [200, 38, 38] as const;
const AMBER = [180, 120, 10] as const;

const REC_LABELS: Record<string, string> = {
  strong_candidate: "Strong candidate",
  strong_psa_candidate: "Strong candidate",
  possible_candidate_inspect_first: "Possible — inspect first",
  only_if_value_justifies: "Only if value justifies it",
  sell_raw: "Sell raw instead",
  do_not_grade: "Do not grade",
  needs_better_photos: "Needs better photos",
};

function moneyRange(low: number, high: number, currency: string): string {
  const sym = currency === "GBP" ? "£" : currency === "USD" ? "$" : currency === "EUR" ? "€" : "";
  const m = (n: number) => `${sym}${Math.round(n).toLocaleString()}`;
  return Math.round(low) === Math.round(high) ? m(low) : `${m(low)}–${m(high)}`;
}

// Convert any image source (data URL or blob URL) to a PNG data URL jsPDF can embed.
async function toPngDataUrl(src?: string): Promise<{ url: string; w: number; h: number } | null> {
  if (!src) return null;
  try {
    const img = await loadImage(src);
    if (!img.naturalWidth) return null;
    const max = 900;
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    return { url: canvas.toDataURL("image/png"), w, h };
  } catch {
    return null;
  }
}

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const img = await loadImage("/gemcheck-logo.png");
    if (!img.naturalWidth) return null;
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

function drawReportHeader(
  doc: jsPDF,
  PAGE_W: number,
  M: number,
  logo: string | null,
  setColor: (c: readonly [number, number, number]) => void,
  rule: () => void
): number {
  doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.rect(0, 0, PAGE_W, 2.5, "F");
  let y = M + 1;
  if (logo) {
    const logoW = 32;
    const logoH = 10;
    doc.addImage(logo, "PNG", M, y, logoW, logoH);
    setColor(INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Pre-Grade Report", M + logoW + 4, y + 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    setColor(MUTE);
    doc.text(
      new Date().toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      M + logoW + 4,
      y + 9
    );
    y += logoH + 2;
  } else {
    setColor(INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Card Condition Pre-Grade Report", M, y + 4);
    y += 8;
  }
  y += 1;
  rule();
  return y + 2;
}

export async function buildGradeReportPdf(
  result: GradeResult,
  images: { front?: string; back?: string },
  opts?: { watermark?: boolean }
): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const PAGE_W = doc.internal.pageSize.getWidth();
  const PAGE_H = doc.internal.pageSize.getHeight();
  const M = 12;
  const CONTENT_W = PAGE_W - M * 2;
  let y = M;
  const logo = await loadLogoDataUrl();
  const frontSrc =
    opts?.watermark && images.front ? await applyCropWatermarkToDataUrl(images.front) : images.front;
  const backSrc =
    opts?.watermark && images.back ? await applyCropWatermarkToDataUrl(images.back) : images.back;

  const setColor = (c: readonly [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
  const ensure = (h: number) => {
    if (y + h > PAGE_H - M) {
      doc.addPage();
      y = M;
    }
  };
  const rule = () => {
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.setLineWidth(0.2);
    doc.line(M, y, PAGE_W - M, y);
  };
  const heading = (text: string) => {
    ensure(10);
    y += 3;
    setColor(INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(text, M, y);
    y += 2;
    rule();
    y += 3;
  };
  // Wrapped paragraph. Returns nothing; advances y.
  const para = (
    text: string,
    opts: { size?: number; color?: readonly [number, number, number]; gap?: number; x?: number; w?: number } = {}
  ) => {
    if (!text) return;
    const size = opts.size ?? 9.5;
    const x = opts.x ?? M;
    const w = opts.w ?? CONTENT_W;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    setColor(opts.color ?? MUTE);
    const lines = doc.splitTextToSize(text, w) as string[];
    for (const line of lines) {
      ensure(size * 0.45 + 1.5);
      doc.text(line, x, y);
      y += size * 0.45 + 1.5;
    }
    y += opts.gap ?? 1;
  };

  y = drawReportHeader(doc, PAGE_W, M, logo, setColor, rule);

  // ---------------------------------------------- card identity + images
  const ident = asObj(result.card_identification);
  const imgFront = await toPngDataUrl(frontSrc);
  const imgBack = await toPngDataUrl(backSrc);

  const topY = y + 2;
  // Images on the right.
  const imgBoxW = 30;
  const imgH = 40;
  let imgX = PAGE_W - M - imgBoxW;
  const shots = [imgBack, imgFront].filter(Boolean) as { url: string; w: number; h: number }[];
  for (const s of shots) {
    const ratio = s.w / s.h;
    let w = imgBoxW;
    let h = w / ratio;
    if (h > imgH) {
      h = imgH;
      w = h * ratio;
    }
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.setLineWidth(0.3);
    doc.addImage(s.url, "PNG", imgX + (imgBoxW - w), topY, w, h);
    doc.rect(imgX + (imgBoxW - w), topY, w, h);
    imgX -= imgBoxW + 4;
  }

  // Identity on the left.
  y = topY;
  setColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(asStr(ident.name) || "Unidentified card", M, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  setColor(MUTE);
  const numTxt =
    asStr(ident.number) && asStr(ident.set_total)
      ? `${asStr(ident.number)}/${asStr(ident.set_total)}`
      : asStr(ident.number);
  const variantTxt = [asStr(ident.variant), asStr(ident.holo_type)]
    .filter(Boolean)
    .join(" · ");
  const idBits = [
    asStr(ident.set) && `Set: ${asStr(ident.set)}`,
    numTxt && `No: ${numTxt}`,
    asStr(ident.rarity) && asStr(ident.rarity),
    variantTxt,
    asStr(ident.edition) && `Edition: ${asStr(ident.edition)}`,
    asStr(ident.regulation_mark) && `Reg. mark: ${asStr(ident.regulation_mark)}`,
    asStr(ident.language) && asStr(ident.language),
    asStr(ident.illustrator) && `Illus. ${asStr(ident.illustrator)}`,
  ].filter(Boolean) as string[];
  for (const b of idBits) {
    doc.text(b, M, y);
    y += 4.6;
  }
  const idMarks = asArr(ident.identifiers)
    .map((x) => asStr(x).trim())
    .filter(Boolean);
  if (idMarks.length) {
    const wrapped = doc.splitTextToSize(`Marks: ${idMarks.join(", ")}`, 90) as string[];
    for (const line of wrapped) {
      doc.text(line, M, y);
      y += 4.6;
    }
  }
  if (asStr(ident.confidence)) {
    doc.text(`ID confidence: ${asStr(ident.confidence)}`, M, y);
    y += 4.6;
  }
  y = Math.max(y, topY + imgH) + 2;

  // ------------------------------------------------- recommendation
  const rec = asObj(result.submission_recommendation);
  const recVerdict = asStr(rec.verdict);
  if (recVerdict) {
    heading("Recommendation");
    setColor(INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(REC_LABELS[recVerdict] ?? recVerdict, M, y);
    y += 5;
    if (asStr(rec.best_for)) para(`Best fit: ${asStr(rec.best_for)}`, { color: INK });
    if (asStr(rec.reason)) para(asStr(rec.reason));
  }

  const bgsInsight = asObj(result.bgs_insight);
  const bgsTier = asStr(bgsInsight.tier);
  const bgsLabel = asStr(bgsInsight.label);
  if (bgsTier && bgsLabel) {
    ensure(14);
    const isBlack = bgsTier === "black_label";
    doc.setFillColor(isBlack ? 24 : 236, isBlack ? 24 : 253, isBlack ? 27 : 245);
    doc.rect(M, y, CONTENT_W, 12, "F");
    setColor(isBlack ? [212, 175, 55] : ACCENT);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(
      isBlack ? `BGS Black Label candidate — ${bgsLabel}` : `BGS Pristine 10 candidate — ${bgsLabel}`,
      M + 3,
      y + 5
    );
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    setColor(MUTE);
    const detail = asStr(bgsInsight.detail);
    if (detail) {
      const r = doc.splitTextToSize(detail, CONTENT_W - 6) as string[];
      doc.text(r[0] ?? "", M + 3, y + 9.5);
    }
    y += 14;
  }

  const authentic = asObj(result.authentic);
  if (authentic.is_authentic_only === true) {
    ensure(16);
    doc.setFillColor(253, 235, 235);
    doc.rect(M, y, CONTENT_W, 12, "F");
    setColor(RED);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Authentic / Altered — not gradeable as Mint", M + 3, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const r = doc.splitTextToSize(asStr(authentic.reason) || "Structural damage or alteration detected.", CONTENT_W - 6) as string[];
    doc.text(r[0] ?? "", M + 3, y + 9.5);
    y += 16;
  }

  // ------------------------------------------------- grades by company
  const companies = asArr(result.company_estimates).map(asObj);
  if (companies.length) {
    heading("Estimated grade by company");
    // column layout
    const cCompany = M;
    const cLikely = M + 42;
    const cRange = M + 72;
    const cSubs = M + 116;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    setColor(MUTE);
    doc.text("Company", cCompany, y);
    doc.text("Likely", cLikely, y);
    doc.text("Range", cRange, y);
    doc.text("Subgrades (C / Co / E / S)", cSubs, y);
    y += 2;
    rule();
    y += 4.5;
    for (const c of companies) {
      ensure(8);
      const subs = asObj(c.subgrades);
      const hasSubs = Object.keys(subs).length > 0;
      setColor(INK);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.text(asStr(c.company) || "—", cCompany, y);
      doc.setFont("helvetica", "normal");
      doc.text(asStr(c.likely) || "—", cLikely, y);
      setColor(MUTE);
      doc.setFontSize(8.8);
      doc.text(`${asStr(c.low) || "?"} – ${asStr(c.high) || "?"}`, cRange, y);
      if (hasSubs) {
        const sg = (["centering", "corners", "edges", "surface"] as const)
          .map((k) => asStr(subs[k]) || "—")
          .join("  /  ");
        doc.text(sg, cSubs, y);
      } else {
        doc.text("—", cSubs, y);
      }
      y += 6;
    }
  }

  // ------------------------------------------------- condition scores
  const scoreRow = (label: string, obj: unknown) => {
    const o = asObj(obj);
    const score = asNum(o.score);
    ensure(10);
    setColor(INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(label, M, y);
    doc.text(score != null ? score.toFixed(1) : "—", M + 36, y);
    // bar
    const barX = M + 50;
    const barW = CONTENT_W - 50;
    doc.setFillColor(LINE[0], LINE[1], LINE[2]);
    doc.roundedRect(barX, y - 2.6, barW, 2.4, 1, 1, "F");
    if (score != null) {
      const c = score >= 8.5 ? [16, 160, 90] : score >= 7 ? ACCENT : [200, 140, 10];
      doc.setFillColor(c[0], c[1], c[2]);
      doc.roundedRect(barX, y - 2.6, Math.max(1, barW * (score / 10)), 2.4, 1, 1, "F");
    }
    y += 4;
    if (asStr(o.verdict)) para(asStr(o.verdict), { size: 8.3, gap: 0.5 });
    y += 1.5;
  };
  heading("Condition breakdown");
  scoreRow("Corners", result.corners);
  scoreRow("Edges", result.edges);
  scoreRow("Surface", result.surface);
  scoreRow("Eye appeal", result.eye_appeal);

  // ------------------------------------------------- centering
  const cent = asObj(result.centering);
  const centBits = [
    asStr(cent.front_left_right) && `Front L/R ${asStr(cent.front_left_right)}`,
    asStr(cent.front_top_bottom) && `Front T/B ${asStr(cent.front_top_bottom)}`,
    asStr(cent.back_left_right) && `Back L/R ${asStr(cent.back_left_right)}`,
    asStr(cent.back_top_bottom) && `Back T/B ${asStr(cent.back_top_bottom)}`,
  ].filter(Boolean) as string[];
  if (centBits.length) {
    heading(`${CENTRING_SECTION_TITLE}${cent.measured === true ? "  (measured)" : ""}`);
    para(centBits.join("     "), { color: INK, size: 9.5 });
    if (asStr(cent.verdict)) para(asStr(cent.verdict));
  }

  // ------------------------------------------------- value
  const pricing = result.pricing as CardPricing | undefined;
  if (pricing && pricing.raw) {
    heading("Estimated value (rough)");
    para(`Raw / ungraded: ${moneyRange(pricing.raw.low, pricing.raw.high, pricing.currency)}`, { color: INK });
    for (const g of pricing.graded ?? []) {
      para(
        `${g.company}${g.grade ? ` · ${g.grade}` : ""}: ${moneyRange(g.low, g.high, pricing.currency)}`,
        { size: 9, gap: 0 }
      );
    }
    para(`Confidence: ${pricing.confidence}${pricing.source ? ` · ${pricing.source}` : ""}${pricing.asOf ? ` · ${pricing.asOf}` : ""}${pricing.note ? ` — ${pricing.note}` : ""}`, { size: 8, color: MUTE });
  }

  // ------------------------------------------------- blockers + caps
  const blockers = asObj(result.grade_blockers);
  const caps = asArr(result.hard_grade_caps).map(asObj);
  const listBlock = (title: string, items: unknown[]) => {
    if (!items.length) return;
    ensure(8);
    setColor(INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(title, M, y);
    y += 4.5;
    for (const it of items) para(`•  ${asStr(it)}`, { size: 8.8, gap: 0, x: M + 2, w: CONTENT_W - 2 });
    y += 1.5;
  };
  if (
    caps.length ||
    asArr(blockers.gem_mint).length ||
    asArr(blockers.mint).length ||
    asArr(blockers.near_mint).length
  ) {
    heading("What limits the grade");
    if (caps.length) {
      ensure(8);
      setColor(RED);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.text("Hard caps", M, y);
      y += 4.5;
      for (const c of caps) {
        const t = `•  ${asStr(c.cap)}${asStr(c.reason) ? ` — ${asStr(c.reason)}` : ""}`;
        para(t, { size: 8.8, gap: 0, x: M + 2, w: CONTENT_W - 2, color: INK });
      }
      y += 1.5;
    }
    listBlock("Blocks gem mint", asArr(blockers.gem_mint));
    listBlock("Blocks mint (~9)", asArr(blockers.mint));
    listBlock("Blocks near-mint (~8)", asArr(blockers.near_mint));
  }

  // ------------------------------------------------- inspection notes
  const structural = asArr(result.structural_damage).map(asObj);
  const observations = asArr(result.observations).map(asObj);
  if (structural.length || observations.length) {
    heading("Inspection notes");
    if (structural.length) {
      ensure(8);
      setColor(RED);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.text("Structural damage", M, y);
      y += 4.5;
      for (const d of structural) {
        const t = `•  [${asStr(d.severity) || "—"}] ${asStr(d.type).replace(/_/g, " ")}${asStr(d.where) ? ` — ${asStr(d.where)}` : ""}`;
        para(t, { size: 8.8, gap: 0, x: M + 2, w: CONTENT_W - 2, color: INK });
      }
      y += 1.5;
    }
    if (observations.length) {
      ensure(8);
      setColor(INK);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.text("Other observations", M, y);
      y += 4.5;
      for (const o of observations) {
        const t = `•  [${asStr(o.severity) || "note"}] ${asStr(o.issue)}${asStr(o.where) ? ` — ${asStr(o.where)}` : ""}${asStr(o.likely) ? ` (${asStr(o.likely)})` : ""}`;
        para(t, { size: 8.8, gap: 0, x: M + 2, w: CONTENT_W - 2 });
      }
      y += 1.5;
    }
  }

  // ------------------------------------------------- preparation + snapshots
  const prep = result.preparation as Preparation | undefined;
  if (prep && prep.items.length) {
    heading("Preparation plan");
    para(prep.summary);
    y += 1;

    // Cache the loaded source images for cropping snapshots.
    const cache: Partial<Record<"front" | "back", HTMLImageElement | null>> = {};
    const srcImg = async (side: "front" | "back") => {
      if (!(side in cache)) {
        const src = side === "back" ? images.back : images.front;
        cache[side] = src ? await loadImage(src).catch(() => null) : null;
      }
      return cache[side] ?? null;
    };

    const drawItem = async (item: PrepItem) => {
      const rowH = 26;
      ensure(rowH);
      const img = await srcImg(item.side);
      const shotSize = 22;
      const textX = M + shotSize + 4;
      const textW = CONTENT_W - shotSize - 4;
      const top = y;

      // snapshot
      let snap: string | null = null;
      if (img) snap = cropFromImage(img, resolveRect(item.region, item.bbox), 300);
      doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
      doc.setLineWidth(0.3);
      if (snap) doc.addImage(snap, "PNG", M, top, shotSize, shotSize);
      doc.rect(M, top, shotSize, shotSize);

      // text
      let ty = top + 3;
      setColor(INK);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.text(item.label, textX, ty);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.8);
      setColor(item.canAttempt ? AMBER : RED);
      doc.text(
        `${item.location} · ${item.risk} risk${item.canAttempt ? `, ${item.difficulty}` : " · leave alone"}`,
        textX,
        ty + 3.6
      );
      ty += 7.5;
      setColor(INK);
      doc.setFontSize(8.5);
      for (const line of doc.splitTextToSize(item.action, textW) as string[]) {
        doc.text(line, textX, ty);
        ty += 3.4;
      }
      if (item.method) {
        setColor(MUTE);
        doc.setFontSize(7.8);
        for (const line of doc.splitTextToSize(item.method, textW) as string[]) {
          doc.text(line, textX, ty);
          ty += 3.2;
        }
      }
      y = Math.max(top + shotSize, ty) + 4;
    };

    const safe = prep.items.filter((it) => it.canAttempt);
    const avoid = prep.items.filter((it) => !it.canAttempt);
    if (safe.length) {
      setColor([16, 130, 80]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      ensure(6);
      doc.text(`Safe to prep (${safe.length})`, M, y);
      y += 5;
      for (const it of safe) await drawItem(it);
    }
    if (avoid.length) {
      setColor(RED);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      ensure(6);
      doc.text(`Leave alone (${avoid.length})`, M, y);
      y += 5;
      for (const it of avoid) await drawItem(it);
    }
    if (prep.disclaimer) para(prep.disclaimer, { size: 7.6, color: MUTE });
  }

  // ------------------------------------------------- summary + disclaimer
  if (asStr(result.summary)) {
    heading("Summary");
    para(asStr(result.summary), { color: INK });
  }

  y += 2;
  ensure(20);
  rule();
  y += 4;
  para(asStr(result.disclaimer), { size: 7.5, color: MUTE });

  if (opts?.watermark) {
    applyPdfFreePlanWatermark(doc, logo);
  }

  // Page numbers footer.
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    setColor(MUTE);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(`GemCheck pre-grade report · page ${p} of ${pageCount}`, M, PAGE_H - 6);
  }

  const name = (asStr(ident.name) || "card").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`gemcheck-pregrade-${name}.pdf`);
}
