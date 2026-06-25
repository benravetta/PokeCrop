import { jsPDF } from "jspdf";

export function buildHumanPregradePdfBuffer(reportData: Record<string, unknown>): Buffer {
  const doc = new jsPDF();
  let y = 20;
  const line = (text: string, size = 11, bold = false) => {
    doc.setFontSize(size);
    if (bold) doc.setFont("helvetica", "bold");
    else doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(text, 180);
    doc.text(lines, 14, y);
    y += lines.length * (size * 0.45) + 4;
  };

  const card = (reportData.card ?? {}) as Record<string, unknown>;
  const a = (reportData.assessment ?? {}) as Record<string, unknown>;
  const predictions = (reportData.predictions ?? []) as Record<string, unknown>[];
  const defects = (reportData.defects ?? []) as Record<string, unknown>[];

  line(String(reportData.productName ?? "GemCheck Expert Review"), 16, true);
  line(`Order: ${String(reportData.orderReference ?? "")}`, 10);
  line(String(card.name ?? "Card"), 12, true);
  line(`${String(card.set ?? "")} ${String(card.number ?? "")}`, 10);

  if (a.conditionSummary) {
    line("Condition summary", 11, true);
    line(String(a.conditionSummary), 10);
  }
  if (a.mainGradeLimiter) line(`Main limiter: ${String(a.mainGradeLimiter)}`, 10);

  const scores = [
    ["Centering", a.centeringScore],
    ["Corners", a.cornersScore],
    ["Edges", a.edgesScore],
    ["Surface", a.surfaceScore],
  ].filter(([, v]) => v != null);
  if (scores.length) {
    line("Sub-scores", 11, true);
    for (const [label, val] of scores) line(`${label}: ${val}`, 10);
  }

  if (predictions.length) {
    line("Grader predictions", 11, true);
    for (const p of predictions) {
      line(
        `Most likely ${p.mostLikelyGrade} (range ${p.minimumGrade}–${p.maximumGrade}, confidence ${p.confidence})`,
        10
      );
      if (p.explanation) line(String(p.explanation), 9);
    }
  }

  if (defects.length) {
    line("Notable defects", 11, true);
    for (const d of defects) {
      line(`• ${d.title} (${d.severity})`, 10);
    }
  }

  y += 4;
  doc.setFontSize(8);
  doc.text(
    doc.splitTextToSize(
      "This report is an independent human pre-grading opinion based solely on digital images supplied. It is not official grading, certification or authentication.",
      180
    ),
    14,
    Math.min(y, 270)
  );

  return Buffer.from(doc.output("arraybuffer"));
}
