// Server-side GemCheck pre-grade PDF (matches the web app's gradeReportPdf.ts).

import { jsPDF } from "jspdf";
import {
  cropSnapshot,
  loadReportImage,
  resolveRect,
  toPngDataUrl,
} from "./gradeReportPdfImages.js";

const asObj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const asStr = (v: unknown): string => (typeof v === "string" ? v : "");
const asArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asNum = (v: unknown): number | null => (typeof v === "number" ? v : null);

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

interface PrepItem {
  side: "front" | "back";
  label: string;
  location: string;
  action: string;
  method?: string;
  canAttempt: boolean;
  risk: string;
  difficulty: string;
  region: string;
  bbox?: number[] | null;
}

interface Preparation {
  summary?: string;
  disclaimer?: string;
  items: PrepItem[];
}

function moneyRange(low: number, high: number, currency: string): string {
  const sym = currency === "GBP" ? "£" : currency === "USD" ? "$" : currency === "EUR" ? "€" : "";
  const m = (n: number) => `${sym}${Math.round(n).toLocaleString()}`;
  return Math.round(low) === Math.round(high) ? m(low) : `${m(low)}–${m(high)}`;
}

export interface GradeReportImages {
  front?: Buffer;
  back?: Buffer;
  frontName?: string;
  backName?: string;
}

export async function buildGradeReportPdfBuffer(
  result: Record<string, unknown>,
  images: GradeReportImages
): Promise<{ buffer: Buffer; filename: string }> {
  const frontJimp = images.front
    ? await loadReportImage(images.front, images.frontName)
    : null;
  const backJimp = images.back ? await loadReportImage(images.back, images.backName) : null;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const PAGE_W = doc.internal.pageSize.getWidth();
  const PAGE_H = doc.internal.pageSize.getHeight();
  const M = 14;
  const CONTENT_W = PAGE_W - M * 2;
  let y = M;

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
    ensure(12);
    y += 4;
    setColor(INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(text, M, y);
    y += 2.5;
    rule();
    y += 4;
  };
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

  doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.rect(0, 0, PAGE_W, 3, "F");
  setColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  y = M + 4;
  doc.text("Card Condition Pre-Grade Report", M, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setColor(MUTE);
  doc.text(
    `GemCheck AI Pre-Grader · ${new Date().toLocaleDateString("en-GB", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })}`,
    M,
    y
  );
  y += 4;
  rule();
  y += 2;

  const ident = asObj(result.card_identification);
  const imgFront = frontJimp ? await toPngDataUrl(frontJimp) : null;
  const imgBack = backJimp ? await toPngDataUrl(backJimp) : null;

  const topY = y + 4;
  const imgBoxW = 34;
  const imgH = 44;
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
  const variantTxt = [asStr(ident.variant), asStr(ident.holo_type)].filter(Boolean).join(" · ");
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
    for (const line of doc.splitTextToSize(`Marks: ${idMarks.join(", ")}`, 90) as string[]) {
      doc.text(line, M, y);
      y += 4.6;
    }
  }
  if (asStr(ident.confidence)) {
    doc.text(`ID confidence: ${asStr(ident.confidence)}`, M, y);
    y += 4.6;
  }
  y = Math.max(y, topY + imgH) + 2;

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
    const r = doc.splitTextToSize(
      asStr(authentic.reason) || "Structural damage or alteration detected.",
      CONTENT_W - 6
    ) as string[];
    doc.text(r[0] ?? "", M + 3, y + 9.5);
    y += 16;
  }

  const companies = asArr(result.company_estimates).map(asObj);
  if (companies.length) {
    heading("Estimated grade by company");
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
      doc.text(
        hasSubs
          ? (["centering", "corners", "edges", "surface"] as const)
              .map((k) => asStr(subs[k]) || "—")
              .join("  /  ")
          : "—",
        cSubs,
        y
      );
      y += 6;
    }
  }

  const scoreRow = (label: string, obj: unknown) => {
    const o = asObj(obj);
    const score = asNum(o.score);
    ensure(10);
    setColor(INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(label, M, y);
    doc.text(score != null ? score.toFixed(1) : "—", M + 36, y);
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

  const cent = asObj(result.centering);
  const centBits = [
    asStr(cent.front_left_right) && `Front L/R ${asStr(cent.front_left_right)}`,
    asStr(cent.front_top_bottom) && `Front T/B ${asStr(cent.front_top_bottom)}`,
    asStr(cent.back_left_right) && `Back L/R ${asStr(cent.back_left_right)}`,
    asStr(cent.back_top_bottom) && `Back T/B ${asStr(cent.back_top_bottom)}`,
  ].filter(Boolean) as string[];
  if (centBits.length) {
    heading(`Centering${cent.measured === true ? "  (measured)" : ""}`);
    para(centBits.join("     "), { color: INK, size: 9.5 });
    if (asStr(cent.verdict)) para(asStr(cent.verdict));
  }

  const pricing = asObj(result.pricing);
  const rawPricing = asObj(pricing.raw);
  if (typeof rawPricing.low === "number" && typeof rawPricing.high === "number") {
    heading("Estimated value (rough)");
    para(
      `Raw / ungraded: ${moneyRange(rawPricing.low, rawPricing.high, asStr(pricing.currency) || "GBP")}`,
      { color: INK }
    );
    for (const g of asArr(pricing.graded).map(asObj)) {
      if (typeof g.low !== "number" || typeof g.high !== "number") continue;
      para(
        `${asStr(g.company)}${asStr(g.grade) ? ` · ${asStr(g.grade)}` : ""}: ${moneyRange(g.low, g.high, asStr(pricing.currency) || "GBP")}`,
        { size: 9, gap: 0 }
      );
    }
    para(
      `Confidence: ${asStr(pricing.confidence)}${asStr(pricing.source) ? ` · ${asStr(pricing.source)}` : ""}${asStr(pricing.asOf) ? ` · ${asStr(pricing.asOf)}` : ""}${asStr(pricing.note) ? ` — ${asStr(pricing.note)}` : ""}`,
      { size: 8, color: MUTE }
    );
  }

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
    for (const it of items)
      para(`•  ${asStr(it)}`, { size: 8.8, gap: 0, x: M + 2, w: CONTENT_W - 2 });
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
        para(
          `•  ${asStr(c.cap)}${asStr(c.reason) ? ` — ${asStr(c.reason)}` : ""}`,
          { size: 8.8, gap: 0, x: M + 2, w: CONTENT_W - 2, color: INK }
        );
      }
      y += 1.5;
    }
    listBlock("Blocks gem mint", asArr(blockers.gem_mint));
    listBlock("Blocks mint (~9)", asArr(blockers.mint));
    listBlock("Blocks near-mint (~8)", asArr(blockers.near_mint));
  }

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
        para(
          `•  [${asStr(d.severity) || "—"}] ${asStr(d.type).replace(/_/g, " ")}${asStr(d.where) ? ` — ${asStr(d.where)}` : ""}`,
          { size: 8.8, gap: 0, x: M + 2, w: CONTENT_W - 2, color: INK }
        );
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
        para(
          `•  [${asStr(o.severity) || "note"}] ${asStr(o.issue)}${asStr(o.where) ? ` — ${asStr(o.where)}` : ""}${asStr(o.likely) ? ` (${asStr(o.likely)})` : ""}`,
          { size: 8.8, gap: 0, x: M + 2, w: CONTENT_W - 2 }
        );
      }
      y += 1.5;
    }
  }

  const prep = result.preparation as Preparation | undefined;
  if (prep?.items?.length) {
    heading("Preparation plan");
    if (prep.summary) para(prep.summary);
    y += 1;

    const cache: Partial<Record<"front" | "back", Awaited<ReturnType<typeof loadReportImage>>>> = {
      front: frontJimp,
      back: backJimp,
    };

    const drawItem = async (item: PrepItem) => {
      const rowH = 26;
      ensure(rowH);
      const img = cache[item.side] ?? null;
      const shotSize = 22;
      const textX = M + shotSize + 4;
      const textW = CONTENT_W - shotSize - 4;
      const top = y;

      let snap: string | null = null;
      if (img) snap = await cropSnapshot(img, resolveRect(item.region, item.bbox ?? null), 300);
      doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
      doc.setLineWidth(0.3);
      if (snap) doc.addImage(snap, "PNG", M, top, shotSize, shotSize);
      doc.rect(M, top, shotSize, shotSize);

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

  if (asStr(result.summary)) {
    heading("Summary");
    para(asStr(result.summary), { color: INK });
  }

  y += 2;
  ensure(20);
  rule();
  y += 4;
  para(asStr(result.disclaimer), { size: 7.5, color: MUTE });

  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    setColor(MUTE);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(`GemCheck pre-grade report · page ${p} of ${pageCount}`, M, PAGE_H - 6);
  }

  const name = (asStr(ident.name) || "card").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const arrayBuffer = doc.output("arraybuffer");
  return {
    buffer: Buffer.from(arrayBuffer),
    filename: `gemcheck-pregrade-${name}.pdf`,
  };
}
