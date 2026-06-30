import { describe, expect, it } from "vitest";
import { buildReportIntelligence } from "./index.js";

describe("report intelligence", () => {
  it("builds deterministic category explanations and ceiling analysis", () => {
    const out = buildReportIntelligence({
      findings: {
        corners: { score: 7.2, verdict: "Minor edge whitening" },
        edges: { score: 6.8, verdict: "Visible edge wear" },
        surface: { score: 8.1, verdict: "Light scratches" },
        eye_appeal: { score: 7.9 },
        card_identification: { confidence: "high" },
        views_present: { front: true, back: true },
        image_suitability: { rating: "good" },
        defects: [
          { kind: "edge_whitening", side: "front", region: "top_edge", severity: "moderate" },
          { kind: "corner_whitening", side: "back", region: "top_left_corner", severity: "minor" },
        ],
      },
      decision: {
        grade_blockers: { gem_mint: ["edge whitening"], mint: ["minor corner whitening"], near_mint: [] },
        hard_grade_caps: [{ cap: "Capped around 8", reason: "edge whitening in multiple zones" }],
      },
      companyEstimates: [{ company: "PSA", low: "PSA 7", likely: "PSA 8", high: "PSA 8" }],
    });

    expect(out.category_explanations).toBeDefined();
    expect((out.grade_ceiling_analysis as Record<string, unknown>).gem_mint).toBeDefined();
    expect((out.why_not_higher as Record<string, unknown>).primary_limiting_defects).toBeDefined();
  });

  it("drops confidence below threshold when capture warnings stack", () => {
    const out = buildReportIntelligence({
      findings: {
        card_identification: { confidence: "low" },
        views_present: { front: true, back: false },
        image_suitability: { rating: "poor" },
      },
      decision: {},
      companyEstimates: [],
      captureQuality: {
        issues: [
          { severity: "warn", message: "blurred" },
          { severity: "warn", message: "glare" },
        ],
      },
    });
    const confidence = out.overall_prediction_confidence as Record<string, unknown>;
    expect((confidence.score as number) < 80).toBe(true);
    expect(typeof confidence.warning).toBe("string");
  });
});
