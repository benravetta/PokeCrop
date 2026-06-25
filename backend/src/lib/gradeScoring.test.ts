import { describe, expect, it } from "vitest";
import { scoreGrades } from "./gradeScoring.js";

function findings(overrides: Record<string, unknown> = {}) {
  return {
    corners: { score: 10, verdict: "Clean" },
    edges: { score: 10, verdict: "Clean" },
    surface: { score: 10, verdict: "Clean" },
    eye_appeal: { score: 10 },
    centering: {
      front_left_right: "60/40",
      front_top_bottom: "55/45",
      back_left_right: "70/30",
      back_top_bottom: "65/35",
      measured: true,
    },
    measured_centering: {
      front: { leftRight: "60/40", topBottom: "55/45" },
      back: { leftRight: "70/30", topBottom: "65/35" },
      measurement_confidence: 0.9,
    },
    structural_damage: [],
    defects: [],
    observations: [],
    ...overrides,
  };
}

function psaLikely(result: ReturnType<typeof scoreGrades>): number {
  const psa = result.company_estimates.find((c) => c.company === "PSA");
  const m = /PSA (\d+)/.exec(psa?.likely ?? "");
  return m ? Number(m[1]) : 0;
}

describe("gradeScoring weighted integration", () => {
  it("PSA 9 centering with PSA 10 subs stays around 9–10, not 7–8", () => {
    const r = scoreGrades(findings());
    const likely = psaLikely(r);
    expect(likely).toBeGreaterThanOrEqual(9);
    expect(likely).toBeLessThanOrEqual(10);
  });

  it("PSA 10 centering with surface damage caps overall grade", () => {
    const r = scoreGrades(
      findings({
        surface: { score: 5, verdict: "Heavy wear" },
        structural_damage: [{ type: "indentation", severity: "minor" }],
      })
    );
    const likely = psaLikely(r);
    expect(likely).toBeLessThanOrEqual(8);
  });

  it("structural tear cap still dominates centering", () => {
    const r = scoreGrades(
      findings({
        centering: {
          front_left_right: "50/50",
          front_top_bottom: "50/50",
          measured: true,
        },
        measured_centering: {
          front: { leftRight: "50/50", topBottom: "50/50" },
          measurement_confidence: 0.95,
        },
        structural_damage: [{ type: "tear", severity: "major" }],
      })
    );
    expect(r.caps.overallCap).toBeLessThanOrEqual(2);
    const psa = r.company_estimates.find((c) => c.company === "PSA");
    expect(psaLikely(r)).toBeLessThanOrEqual(2);
  });

  it("poor centering with pristine subs does not collapse to min-subgrade floor", () => {
    const r = scoreGrades(
      findings({
        centering: {
          front_left_right: "70/30",
          front_top_bottom: "50/50",
          measured: true,
        },
        measured_centering: {
          front: { leftRight: "70/30", topBottom: "50/50" },
          measurement_confidence: 0.9,
        },
      })
    );
    const likely = psaLikely(r);
    expect(likely).toBeGreaterThanOrEqual(7);
  });

  it("includes centering_analysis when ratios present", () => {
    const r = scoreGrades(findings());
    expect(r.centering_analysis).toBeDefined();
    expect(r.centering_analysis?.grader_results?.PSA).toBeDefined();
  });

  it("adds predicted_range on company estimates", () => {
    const r = scoreGrades(findings());
    const psa = r.company_estimates.find((c) => c.company === "PSA");
    expect(psa?.predicted_range).toEqual(expect.arrayContaining([expect.any(Number)]));
  });
});
