import { describe, expect, it } from "vitest";
import { canAnonymousViewCard, effectiveCardVisibility } from "../domain/visibility.js";

describe("collector security rules", () => {
  it("private profile blocks public cards", () => {
    expect(canAnonymousViewCard("public", "private", "active", "active")).toBe(false);
  });

  it("viewer grade cannot inherit public card when profile private", () => {
    expect(effectiveCardVisibility("public", "private")).toBe("private");
  });
});
