import { describe, expect, it } from "vitest";
import {
  DEFAULT_GRADING_CENTERING_CONFIG,
  getGradingCenteringConfig,
  thresholdsForGrader,
} from "./centering.v1.js";

describe("centering.v1 criteria", () => {
  it("exports versioned config with all five graders", () => {
    const cfg = getGradingCenteringConfig();
    expect(cfg.version).toBe("centering.v1");
    for (const g of ["ACE", "PSA", "BGS", "CGC", "TAG"] as const) {
      expect(cfg.centering_weight_by_grader[g]).toBeGreaterThan(0);
      expect(thresholdsForGrader(g).length).toBeGreaterThan(0);
    }
  });

  it("tags PSA thresholds as approximate published criteria", () => {
    const psa10 = thresholdsForGrader("PSA").find((r) => r.grade === 10);
    expect(psa10?.is_approximate).toBe(true);
    expect(psa10?.source_type).toBe("published");
    expect(psa10?.front_horizontal_max).toBe(55);
    expect(psa10?.back_horizontal_max).toBe(75);
  });

  it("tags inferred CGC lower-grade bands correctly", () => {
    const cgc9 = thresholdsForGrader("CGC").find((r) => r.grade === 9);
    expect(cgc9?.threshold_type).toBe("inferred");
    expect(cgc9?.source_type).toBe("engine_interpolation");
  });

  it("includes BGS 9.5 dual-axis rule row", () => {
    const bgs95 = thresholdsForGrader("BGS").find((r) => r.grade === 9.5);
    expect(bgs95?.bgs_dual_axis_rule).toBe(true);
  });

  it("does not include ACE grade 1 numeric row", () => {
    const ace1 = thresholdsForGrader("ACE").find((r) => r.grade === 1);
    expect(ace1).toBeUndefined();
  });

  it("includes TAG score bands on published rows", () => {
    const tagPristine = thresholdsForGrader("TAG").find((r) => r.tag_score_min === 990);
    expect(tagPristine?.front_horizontal_max).toBe(51);
    expect(tagPristine?.back_horizontal_max).toBe(52);
  });

  it("uses configured weight targets from spec", () => {
    const w = DEFAULT_GRADING_CENTERING_CONFIG.centering_weight_by_grader;
    expect(w.PSA).toBe(0.15);
    expect(w.BGS).toBe(0.25);
    expect(w.ACE).toBe(0.18);
  });
});
