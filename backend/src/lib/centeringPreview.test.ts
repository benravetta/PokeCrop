import { describe, expect, it } from "vitest";
import { previewCentering } from "./centeringPreview.js";
import type { MeasuredCentering } from "./grading.js";

describe("previewCentering", () => {
  it("returns collector-safe hints for measured ratios", () => {
    const c: MeasuredCentering = {
      front: { leftRight: "55/45", topBottom: "52/48" },
      back: { leftRight: "70/30", topBottom: "65/35" },
      measurement_confidence: 0.88,
    };
    const out = previewCentering(c);
    expect(out.hints.length).toBe(5);
    expect(out.explanation).toBeTruthy();
    expect(out.measurement_confidence).toBeGreaterThan(0.5);
    const psa = out.hints.find((h) => h.grader === "PSA");
    expect(psa?.centering_equivalent).not.toBeNull();
  });

  it("does not expose internal threshold metadata", () => {
    const out = previewCentering({
      front: { leftRight: "60/40", topBottom: "55/45" },
      measurement_confidence: 0.9,
    });
    expect(JSON.stringify(out)).not.toMatch(/threshold_source|grade_cap_confidence/);
  });
});
