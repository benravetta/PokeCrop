import { describe, expect, it } from "vitest";
import type { HumanPregradeStatus } from "../domain/types.js";
import { canTransition, assertTransition } from "../domain/transitions.js";
import { buildReportData, renderReportHtml } from "../reports/buildReport.js";

const ALL_STATUSES: HumanPregradeStatus[] = [
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

describe("status transition matrix", () => {
  it("allows every documented happy-path step", () => {
    const path: HumanPregradeStatus[] = [
      "draft",
      "awaiting_payment",
      "paid",
      "submitted",
      "queued",
      "assigned",
      "under_review",
      "report_drafting",
      "quality_check",
      "completed",
    ];
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i]!, path[i + 1]!)).toBe(true);
    }
  });

  it("rejects illegal jumps across the lifecycle", () => {
    expect(canTransition("draft", "completed")).toBe(false);
    expect(canTransition("queued", "completed")).toBe(false);
    expect(canTransition("completed", "refunded")).toBe(false);
    expect(() => assertTransition("paid", "under_review")).toThrow();
  });

  it("covers image-request branch", () => {
    expect(canTransition("under_review", "awaiting_customer_images")).toBe(true);
    expect(canTransition("awaiting_customer_images", "customer_images_received")).toBe(true);
    expect(canTransition("customer_images_received", "under_review")).toBe(true);
  });

  it("allows QA return and unable-to-assess refund paths", () => {
    expect(canTransition("quality_check", "under_review")).toBe(true);
    expect(canTransition("under_review", "unable_to_assess")).toBe(true);
    expect(canTransition("unable_to_assess", "refunded")).toBe(true);
    expect(canTransition("cancelled", "refunded")).toBe(true);
  });

  it("only permits transitions defined in the adjacency map", () => {
    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        if (from === to) continue;
        const allowed = canTransition(from, to);
        if (allowed) {
          expect(() => assertTransition(from, to)).not.toThrow();
        } else {
          expect(() => assertTransition(from, to)).toThrow();
        }
      }
    }
  });
});

describe("report builder", () => {
  it("builds customer-visible report payload and html", () => {
    const order = {
      service_name_snapshot: "GemCheck Expert Review",
      public_id: "00000000-0000-4000-8000-000000000001",
      completed_at: "2026-06-25T00:00:00.000Z",
      card_game: "Pokemon",
      card_name: "Charizard",
      set_name: "Base Set",
      card_number: "4/102",
      language: "English",
      variant: null,
      finish_type: null,
      disclaimer_version: "1.0",
    } as Parameters<typeof buildReportData>[0];

    const data = buildReportData(
      order,
      { condition_summary: "Strong", image_sufficiency: "adequate" },
      [{ grader: "PSA", most_likely_grade: "8" }],
      [{ title: "Corner wear", customer_visible: true }, { title: "Hidden", customer_visible: false }]
    );

    expect(data.card).toMatchObject({ name: "Charizard", set: "Base Set" });
    expect(data.defects).toHaveLength(1);
    expect((data.assessment as Record<string, unknown>).conditionSummary).toBe("Strong");
    const html = renderReportHtml(data);
    expect(html).toContain("Charizard");
    expect(html).toContain("independent human pre-grading opinion");
  });
});
