import { describe, expect, it } from "vitest";
import { detectBgsTier, isBgsBlackLabelCentering } from "./bgsTier.js";

describe("bgsTier Black Label centering guard", () => {
  it("requires measured 50/50 front for Black Label", () => {
    expect(
      isBgsBlackLabelCentering({
        frontLR: "50/50",
        frontTB: "50/50",
        measured: true,
      })
    ).toBe(true);
    expect(
      isBgsBlackLabelCentering({
        frontLR: "55/45",
        frontTB: "50/50",
        measured: true,
      })
    ).toBe(false);
  });

  it("does not award Black Label when subs are 10 but centering is not perfect", () => {
    const tier = detectBgsTier(
      [10, 10, 10, 10],
      10,
      { frontLR: "55/45", frontTB: "52/48", measured: true }
    );
    expect(tier).toBeNull();
  });

  it("awards Black Label when subs are 10 and front is 50/50 both axes", () => {
    const tier = detectBgsTier(
      [10, 10, 10, 10],
      10,
      { frontLR: "50/50", frontTB: "50/50", measured: true }
    );
    expect(tier).toBe("black_label");
  });
});
