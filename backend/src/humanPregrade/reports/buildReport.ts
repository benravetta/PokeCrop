import type { HumanPregradeOrderRow } from "../domain/types.js";

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildReportData(
  order: HumanPregradeOrderRow,
  assessment: Record<string, unknown>,
  predictions: unknown[],
  defects: unknown[]
) {
  return {
    productName: order.service_name_snapshot,
    orderReference: order.public_id,
    completedAt: order.completed_at,
    templateVersion: "1.1",
    card: {
      game: order.card_game,
      name: order.card_name,
      set: order.set_name,
      number: order.card_number,
      language: order.language,
      variant: order.variant,
      finish: order.finish_type,
    },
    assessment: {
      conditionSummary: assessment.condition_summary,
      imageSufficiency: assessment.image_sufficiency,
      alterationRisk: assessment.alteration_risk,
      authenticityRisk: assessment.authenticity_risk,
      centeringScore: assessment.centering_score,
      cornersScore: assessment.corners_score,
      edgesScore: assessment.edges_score,
      surfaceScore: assessment.surface_score,
      printQualityScore: assessment.print_quality_score,
      eyeAppealScore: assessment.eye_appeal_score,
      keyPositiveFactors: assessment.key_positive_factors,
      keyNegativeFactors: assessment.key_negative_factors,
      mainGradeLimiter: assessment.main_grade_limiter,
      submissionRecommendation: assessment.submission_recommendation,
    },
    predictions: predictions.map((p) => {
      const row = p as Record<string, unknown>;
      return {
        graderId: row.grader_id,
        mostLikelyGrade: row.most_likely_grade,
        minimumGrade: row.minimum_grade,
        maximumGrade: row.maximum_grade,
        confidence: row.confidence,
        explanation: row.explanation,
        mainLimiter: row.main_limiter,
      };
    }),
    defects: defects
      .filter((d) => (d as { customer_visible?: boolean }).customer_visible !== false)
      .map((d) => {
        const row = d as Record<string, unknown>;
        return {
          title: row.title,
          category: row.category,
          severity: row.severity,
          description: row.description,
          gradingImpact: row.grading_impact,
        };
      }),
    disclaimer: order.disclaimer_version,
    reportVersion: 1,
  };
}

export function renderReportHtml(reportData: Record<string, unknown>): string {
  const card = (reportData.card ?? {}) as Record<string, unknown>;
  const a = (reportData.assessment ?? {}) as Record<string, unknown>;
  const predictions = (reportData.predictions ?? []) as Record<string, unknown>[];
  const defects = (reportData.defects ?? []) as Record<string, unknown>[];

  const scores = [
    ["Centering", a.centeringScore],
    ["Corners", a.cornersScore],
    ["Edges", a.edgesScore],
    ["Surface", a.surfaceScore],
    ["Print quality", a.printQualityScore],
    ["Eye appeal", a.eyeAppealScore],
  ]
    .filter(([, v]) => v != null)
    .map(([label, v]) => `<tr><td>${esc(label)}</td><td>${esc(v)}</td></tr>`)
    .join("");

  const predRows = predictions
    .map(
      (p) =>
        `<tr><td>${esc(p.mostLikelyGrade)}</td><td>${esc(p.minimumGrade)} – ${esc(p.maximumGrade)}</td><td>${esc(p.confidence)}</td><td>${esc(p.explanation)}</td></tr>`
    )
    .join("");

  const defectList = defects
    .map(
      (d) =>
        `<li><strong>${esc(d.title)}</strong> (${esc(d.severity)}) — ${esc(d.description ?? d.gradingImpact ?? "")}</li>`
    )
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Expert Review</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem;color:#111}
table{border-collapse:collapse;width:100%;margin:1rem 0}td,th{border:1px solid #ccc;padding:.4rem .6rem;text-align:left}
.disclaimer{font-size:.85rem;color:#444;margin-top:2rem;border-top:1px solid #ddd;padding-top:1rem}</style></head><body>
<h1>${esc(reportData.productName ?? "GemCheck Expert Review")}</h1>
<p>Order reference: ${esc(reportData.orderReference)}</p>
${reportData.completedAt ? `<p>Completed: ${esc(new Date(String(reportData.completedAt)).toLocaleDateString())}</p>` : ""}
<h2>${esc(card.name ?? "Card")}</h2>
<p>${esc(card.set)} ${esc(card.number)}${card.game ? ` · ${esc(card.game)}` : ""}</p>
<h3>Condition summary</h3>
<p>${esc(a.conditionSummary)}</p>
${a.mainGradeLimiter ? `<p><strong>Main grade limiter:</strong> ${esc(a.mainGradeLimiter)}</p>` : ""}
${a.keyPositiveFactors ? `<p><strong>Positive factors:</strong> ${esc(a.keyPositiveFactors)}</p>` : ""}
${a.keyNegativeFactors ? `<p><strong>Negative factors:</strong> ${esc(a.keyNegativeFactors)}</p>` : ""}
${scores ? `<h3>Sub-scores</h3><table><tbody>${scores}</tbody></table>` : ""}
${predRows ? `<h3>Grader predictions</h3><table><thead><tr><th>Most likely</th><th>Range</th><th>Confidence</th><th>Notes</th></tr></thead><tbody>${predRows}</tbody></table>` : ""}
${defectList ? `<h3>Notable defects</h3><ul>${defectList}</ul>` : ""}
<p class="disclaimer"><em>This report is an independent human pre-grading opinion based solely on digital images supplied. It is not official grading, certification or authentication. Template v${esc(reportData.templateVersion ?? "1.1")}.</em></p>
</body></html>`;
}
