import { describe, expect, it } from "vitest";
import { resolveCustomerProgress, CUSTOMER_PROGRESS_STEPS } from "../domain/transitions.js";
import type { HumanPregradeStatus } from "../domain/types.js";

const ALL: HumanPregradeStatus[] = [
  "draft",
  "awaiting_payment",
  "paid",
  "awaiting_submission",
  "submitted",
  "queued",
  "assigned",
  "under_review",
  "awaiting_customer_images",
  "customer_images_received",
  "report_drafting",
  "quality_check",
  "completed",
  "unable_to_assess",
  "cancelled",
  "refunded",
];

describe("resolveCustomerProgress", () => {
  it("has 7 progress steps", () => {
    expect(CUSTOMER_PROGRESS_STEPS).toHaveLength(7);
  });

  it("maps completed to step 7 at 100%", () => {
    const p = resolveCustomerProgress("completed");
    expect(p.step).toBe(7);
    expect(p.percentComplete).toBe(100);
    expect(p.label).toBe("Complete");
  });

  it("flags awaiting_customer_images as branch step 5", () => {
    const p = resolveCustomerProgress("awaiting_customer_images");
    expect(p.isBranch).toBe(true);
    expect(p.branchStep).toBe(5);
    expect(p.label).toBe("More images needed");
  });

  it("marks terminal statuses", () => {
    for (const s of ["cancelled", "refunded", "unable_to_assess"] as const) {
      expect(resolveCustomerProgress(s).isTerminal).toBe(true);
    }
  });

  it("resolves every non-draft status without throwing", () => {
    for (const status of ALL) {
      const p = resolveCustomerProgress(status);
      expect(p.totalSteps).toBe(7);
      expect(p.label.length).toBeGreaterThan(0);
    }
  });
});
