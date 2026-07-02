import { describe, expect, it } from "vitest";
import {
  getVisibleSteps,
  getStartIndex,
  getNextIndex,
  getPrevIndex,
  indexOfId,
  type WizardStep,
} from "./useWizardSteps";

const steps = (overrides: Partial<WizardStep>[] = []): WizardStep[] => {
  const base: WizardStep[] = [
    { id: "front", label: "Front", canAdvance: true },
    { id: "front-centring", label: "Front centring", canAdvance: true },
    { id: "extras", label: "Extras", canAdvance: true },
    { id: "back-centring", label: "Back centring", canAdvance: true, hidden: true },
    { id: "review", label: "Review", canAdvance: true },
  ];
  return base.map((s, i) => ({ ...s, ...(overrides[i] ?? {}) }));
};

describe("getVisibleSteps", () => {
  it("skips the optional back-centring step when no back is present", () => {
    const visible = getVisibleSteps(steps());
    expect(visible.map((s) => s.id)).toEqual(["front", "front-centring", "extras", "review"]);
  });

  it("includes back-centring once it is no longer hidden", () => {
    const withBack = steps([{}, {}, {}, { hidden: false }]);
    const visible = getVisibleSteps(withBack);
    expect(visible.map((s) => s.id)).toContain("back-centring");
    expect(visible).toHaveLength(5);
  });
});

describe("getNextIndex", () => {
  it("stays put when the current step gates (canAdvance false)", () => {
    const gated = steps([{ canAdvance: false }]);
    expect(getNextIndex(gated, 0)).toBe(0);
  });

  it("advances to the next visible step when allowed", () => {
    expect(getNextIndex(steps(), 0)).toBe(1);
  });

  it("does not advance past the last visible step", () => {
    const visible = getVisibleSteps(steps());
    expect(getNextIndex(steps(), visible.length - 1)).toBe(visible.length - 1);
  });

  it("counts against visible steps only (hidden back-centring skipped)", () => {
    // Index 2 = extras; next visible is review (back-centring hidden).
    const visible = getVisibleSteps(steps());
    expect(visible[getNextIndex(steps(), 2)].id).toBe("review");
  });
});

describe("getPrevIndex", () => {
  it("never goes below zero", () => {
    expect(getPrevIndex(0)).toBe(0);
    expect(getPrevIndex(3)).toBe(2);
  });
});

describe("getStartIndex (prefill start-step selection)", () => {
  it("starts at the upload step by default", () => {
    expect(getStartIndex(steps())).toBe(0);
    expect(getVisibleSteps(steps())[getStartIndex(steps())].id).toBe("front");
  });

  it("starts at front-centring when prefilled from the crop hand-off", () => {
    const idx = getStartIndex(steps(), "front-centring");
    expect(getVisibleSteps(steps())[idx].id).toBe("front-centring");
  });

  it("falls back to the first visible step when the id is missing", () => {
    expect(getStartIndex(steps(), "does-not-exist")).toBe(0);
  });
});

describe("indexOfId", () => {
  it("resolves visible ids and returns -1 for hidden/unknown", () => {
    expect(indexOfId(steps(), "extras")).toBe(2);
    expect(indexOfId(steps(), "back-centring")).toBe(-1);
    expect(indexOfId(steps(), null)).toBe(-1);
  });
});
