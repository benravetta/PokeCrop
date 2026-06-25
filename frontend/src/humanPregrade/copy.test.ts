import { describe, expect, it } from "vitest";
import { customerStatusLabel, evidenceBadge, resolveCustomerProgress } from "./copy";

describe("human pregrade copy", () => {
  it("labels completed status", () => {
    expect(customerStatusLabel("completed")).toBe("Report ready");
  });

  it("labels under_review for expert review", () => {
    expect(customerStatusLabel("under_review")).toBe("Under expert review");
  });

  it("renders evidence badges", () => {
    expect(evidenceBadge(true)).toBe("Directly verified");
    expect(evidenceBadge(false)).toBe("Archived sale record");
  });

  it("resolves progress for under_review", () => {
    const p = resolveCustomerProgress("under_review");
    expect(p.label).toBe("Under review");
    expect(p.totalSteps).toBe(7);
  });
});
