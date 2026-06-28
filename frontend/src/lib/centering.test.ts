import { describe, expect, it } from "vitest";
import { borderRatios, borderWidths, FULL_BOX } from "./centering";

describe("borderRatios", () => {
  it("computes larger-first ratios from outer/inner boxes", () => {
    const outer = FULL_BOX;
    const inner = { x0: 0.04, y0: 0.03, x1: 0.95, y1: 0.97 };
    const w = borderWidths(outer, inner);
    expect(w.left).toBeCloseTo(0.04, 3);
    expect(w.right).toBeCloseTo(0.05, 3);
    const { leftRight, topBottom } = borderRatios(outer, inner);
    expect(leftRight.ratio).toBe("56/44");
    expect(topBottom.ratio).toBe("50/50");
  });
});
