import { describe, expect, it } from "vitest";
import { parseCustomerOrderDraft, requireText } from "../domain/customerOrderInput.js";
import { HumanPregradeError } from "../domain/types.js";

describe("parseCustomerOrderDraft", () => {
  it("accepts a complete draft", () => {
    const out = parseCustomerOrderDraft({
      cardGame: "Pokemon",
      cardName: "Charizard",
      setName: "Base Set",
      cardNumber: "4/102",
      mainConcern: "Is the holo scratch worth submitting?",
      customerNotes: "  optional  ",
    });
    expect(out.cardName).toBe("Charizard");
    expect(out.customerNotes).toBe("optional");
  });

  it("rejects empty card name", () => {
    expect(() =>
      parseCustomerOrderDraft({
        cardName: "  ",
        setName: "Base Set",
        cardNumber: "4/102",
        mainConcern: "Corners",
      })
    ).toThrow(HumanPregradeError);
  });

  it("rejects empty main concern", () => {
    expect(() =>
      parseCustomerOrderDraft({
        cardName: "Charizard",
        setName: "Base Set",
        cardNumber: "4/102",
        mainConcern: "",
      })
    ).toThrow(HumanPregradeError);
  });
});

describe("requireText", () => {
  it("trims required values", () => {
    expect(requireText("  holo  ", 64, "Field")).toBe("holo");
  });
});
