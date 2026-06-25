import { describe, expect, it } from "vitest";
import { analyzeCentering, centeringSubgradeFor } from "./centeringEngine.js";
import type { CenteringRatios } from "./centeringRatios.js";

function ratios(p: Partial<CenteringRatios>): CenteringRatios {
  return { measured: true, ...p };
}

describe("centeringEngine", () => {
  it("1. perfectly centred card scores high quality", () => {
    const a = analyzeCentering(ratios({ frontLR: "50/50", frontTB: "50/50", backLR: "50/50", backTB: "50/50" }));
    expect(a.raw_centering_quality).toBeGreaterThanOrEqual(95);
    expect(a.grader_results.PSA?.centering_equivalent).toBe(10);
  });

  it("2. PSA 55/45 front and 75/25 back qualifies for PSA 10 band", () => {
    const a = analyzeCentering(ratios({ frontLR: "55/45", frontTB: "52/48", backLR: "75/25", backTB: "70/30" }));
    expect(a.grader_results.PSA?.centering_equivalent).toBe(10);
  });

  it("3. front 56/44 near PSA 10 boundary uses soft cap with high confidence", () => {
    const a = analyzeCentering(
      ratios({ frontLR: "56/44", frontTB: "53/47" }),
      { measured: true, measurement_confidence: 0.91 }
    );
    expect(a.grader_results.PSA?.centering_equivalent).toBe(9);
    expect(["soft", "none"]).toContain(a.grader_results.PSA?.grade_cap);
  });

  it("4. front 60/40 qualifies differently for ACE vs PSA", () => {
    const r = ratios({
      frontLR: "60/40",
      frontTB: "55/45",
      backLR: "55/45",
      backTB: "52/48",
    });
    const ace = centeringSubgradeFor("ACE", r, { measured: true }).score;
    const psa = centeringSubgradeFor("PSA", r, { measured: true }).score;
    expect(ace).toBe(10);
    expect(psa).toBe(9);
  });

  it("5. perfect front with poor back — front limits independently", () => {
    const a = analyzeCentering(ratios({ frontLR: "50/50", frontTB: "50/50", backLR: "90/10", backTB: "88/12" }));
    expect(a.grader_results.PSA?.centering_equivalent).toBeLessThan(10);
  });

  it("6. poor front with perfect back — front still hurts PSA result", () => {
    const a = analyzeCentering(ratios({ frontLR: "70/30", frontTB: "50/50", backLR: "50/50", backTB: "50/50" }));
    expect(a.grader_results.PSA?.centering_equivalent).toBeLessThanOrEqual(8);
  });

  it("7. one good axis and one poor axis uses worst axis", () => {
    const a = analyzeCentering(ratios({ frontLR: "50/50", frontTB: "65/35" }));
    expect(a.worst_front_axis).toBe("vertical");
    expect(a.grader_results.PSA?.centering_equivalent).toBeLessThanOrEqual(8);
  });

  it("8. BGS 9.5 dual-axis: 50/50 and 54/46 front", () => {
    const a = analyzeCentering(
      ratios({ frontLR: "50/50", frontTB: "54/46", backLR: "60/40", backTB: "58/42" }),
      { measured: true, measurement_confidence: 0.9 }
    );
    expect(a.grader_results.BGS?.centering_equivalent).toBeGreaterThanOrEqual(9.5);
  });

  it("9. CGC Pristine vs Gem Mint distinction", () => {
    const pristine = analyzeCentering(ratios({ frontLR: "50/50", frontTB: "50/50", backLR: "50/50", backTB: "50/50" }));
    const gem = analyzeCentering(ratios({ frontLR: "55/45", frontTB: "53/47", backLR: "75/25", backTB: "70/30" }));
    expect(pristine.grader_results.CGC?.cgc_assessment).toMatch(/Pristine/i);
    expect(gem.grader_results.CGC?.cgc_assessment).toMatch(/Gem Mint/i);
  });

  it("10. TAG 990 vs 950 bands", () => {
    const t990 = analyzeCentering(ratios({ frontLR: "51/49", frontTB: "50/50", backLR: "52/48", backTB: "51/49" }));
    const t950 = analyzeCentering(ratios({ frontLR: "55/45", frontTB: "53/47", backLR: "65/35", backTB: "60/40" }));
    expect(t990.grader_results.TAG?.tag_score_band).toMatch(/990/);
    expect(t950.grader_results.TAG?.tag_score_band).toMatch(/950/);
  });

  it("11. low-confidence photograph applies no hard cap", () => {
    const a = analyzeCentering(
      ratios({ frontLR: "65/35", frontTB: "50/50" }),
      { measured: true, measurement_confidence: 0.4, sleeveSuspected: true }
    );
    expect(a.grader_results.PSA?.grade_cap).toBe("none");
  });

  it("12. borderless design reduces confidence", () => {
    const a = analyzeCentering(ratios({ frontLR: "55/45", frontTB: "54/46" }), {
      measured: true,
      borderlessDesign: true,
    });
    expect(a.measurement_confidence).toBeLessThan(0.65);
  });

  it("13. sleeve suspected reduces confidence", () => {
    const a = analyzeCentering(ratios({ frontLR: "55/45", frontTB: "54/46" }), {
      measured: true,
      sleeveSuspected: true,
    });
    expect(a.measurement_confidence).toBeLessThan(0.55);
    expect(a.grader_results.PSA?.grade_cap).toBe("none");
  });

  it("14. perspective warning reduces confidence", () => {
    const a = analyzeCentering(ratios({ frontLR: "55/45", frontTB: "54/46" }), {
      measured: true,
      perspectiveWarning: true,
    });
    expect(a.measurement_confidence).toBeLessThanOrEqual(0.55);
  });

  it("15. possible miscut flagged at extreme ratios", () => {
    const a = analyzeCentering(ratios({ frontLR: "96/4", frontTB: "50/50" }), { measured: true });
    expect(a.is_miscut).toBe(true);
  });

  it("18. threshold within measurement tolerance can retain adjacent band with soft cap", () => {
    const a = analyzeCentering(
      ratios({ frontLR: "56/44", frontTB: "50/50" }),
      { measured: true, measurement_confidence: 0.92 }
    );
    expect(a.grader_results.PSA?.centering_equivalent).toBe(9);
    expect(a.grader_results.PSA?.grade_cap).not.toBe("hard");
  });

  it("19. threshold clearly outside tolerance fails band", () => {
    const a = analyzeCentering(
      ratios({ frontLR: "62/38", frontTB: "50/50" }),
      { measured: true, measurement_confidence: 0.92 }
    );
    expect(a.grader_results.PSA?.centering_equivalent).toBeLessThanOrEqual(9);
  });

  it("20. same card yields different grader equivalents", () => {
    const r = ratios({ frontLR: "60/40", frontTB: "58/42", backLR: "70/30", backTB: "65/35" });
    const a = analyzeCentering(r, { measured: true, measurement_confidence: 0.88 });
    const scores = [
      a.grader_results.ACE?.centering_equivalent,
      a.grader_results.PSA?.centering_equivalent,
      a.grader_results.BGS?.centering_equivalent,
    ];
    expect(new Set(scores).size).toBeGreaterThan(1);
  });
});
