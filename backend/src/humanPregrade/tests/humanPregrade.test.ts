import { describe, expect, it } from "vitest";
import { canTransition, assertTransition, CUSTOMER_STATUS_LABELS } from "../domain/transitions.js";
import { validateProbabilityDistribution, validateAssessmentComplete } from "../domain/validation.js";
import { hasHumanPregradePermission, REVIEWER_DEFAULT } from "../permissions/index.js";
import { isHumanPregradeEnvEnabled } from "../domain/featureFlag.js";
import { buildHumanPregradePdfBuffer } from "../reports/pdf.js";

describe("status transitions", () => {
  it("allows draft → awaiting_payment", () => {
    expect(canTransition("draft", "awaiting_payment")).toBe(true);
  });

  it("rejects completed → draft", () => {
    expect(canTransition("completed", "draft")).toBe(false);
  });

  it("allows under_review → awaiting_customer_images", () => {
    expect(canTransition("under_review", "awaiting_customer_images")).toBe(true);
  });

  it("throws on invalid transition", () => {
    expect(() => assertTransition("completed", "queued")).toThrow();
  });

  it("maps customer labels", () => {
    expect(CUSTOMER_STATUS_LABELS.completed).toBe("Report ready");
    expect(CUSTOMER_STATUS_LABELS.under_review).toBe("Under expert review");
  });
});

describe("probability validation", () => {
  const scale = ["10", "9", "8"];

  it("accepts valid distribution", () => {
    expect(validateProbabilityDistribution({ "10": 0.6, "9": 0.3, "8": 0.1 }, scale)).toBe(true);
  });

  it("rejects invalid sum", () => {
    expect(validateProbabilityDistribution({ "10": 0.5, "9": 0.3 }, scale)).toBe(false);
  });

  it("rejects unknown grade", () => {
    expect(validateProbabilityDistribution({ "7": 1 }, scale)).toBe(false);
  });
});

describe("assessment validation", () => {
  it("requires condition summary and image sufficiency", () => {
    expect(
      validateAssessmentComplete({
        condition_summary: "Good",
        image_sufficiency: "ok",
        main_grade_limiter: "Corner wear",
      })
    ).toBe(true);
    expect(validateAssessmentComplete({ condition_summary: "Good", image_sufficiency: "ok" })).toBe(
      false
    );
  });
});

describe("permissions", () => {
  it("grants all to admin", () => {
    expect(hasHumanPregradePermission([], "human_pregrade.admin.refund", true)).toBe(true);
  });

  it("checks reviewer permissions", () => {
    expect(
      hasHumanPregradePermission(REVIEWER_DEFAULT, "human_pregrade.reviewer.submit", false)
    ).toBe(true);
    expect(hasHumanPregradePermission(REVIEWER_DEFAULT, "human_pregrade.admin.refund", false)).toBe(
      false
    );
  });
});

describe("feature flag env", () => {
  it("reads env toggle", () => {
    const prev = process.env.HUMAN_PREGRADE_ENABLED;
    process.env.HUMAN_PREGRADE_ENABLED = "1";
    expect(isHumanPregradeEnvEnabled()).toBe(true);
    process.env.HUMAN_PREGRADE_ENABLED = prev;
  });
});

describe("report pdf", () => {
  it("builds pdf buffer", () => {
    const buf = buildHumanPregradePdfBuffer({
      productName: "GemCheck Expert Review",
      orderReference: "abc",
      card: { name: "Ninetales", set: "Base Set", number: "12/102" },
    });
    expect(buf.length).toBeGreaterThan(100);
  });
});
