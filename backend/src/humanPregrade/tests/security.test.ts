import { describe, expect, it } from "vitest";
import {
  sanitizeOrderSearchQuery,
  sanitizeCustomerReport,
  validateAISnapshotSize,
} from "../api/security.js";

describe("security helpers", () => {
  it("strips PostgREST metacharacters from search", () => {
    expect(sanitizeOrderSearchQuery("charizard, user_id.eq.evil")).toBe("charizard user_id eq evil");
    expect(sanitizeOrderSearchQuery("a".repeat(200)).length).toBeLessThanOrEqual(100);
  });

  it("sanitizes customer report response", () => {
    const out = sanitizeCustomerReport({
      report_data: { card: { name: "Test" } },
      published_at: "2026-01-01",
      template_version: "1.1",
      disclaimer_version: "1.0",
      version: 1,
      pdf_storage_object_id: "key",
      is_shareable: false,
      public_token: "secret-token",
      html_snapshot: "<html></html>",
      published_by_user_id: "uuid",
    });
    expect(out).not.toHaveProperty("public_token");
    expect(out.reportData).toEqual({ card: { name: "Test" } });
    expect(out.hasPdf).toBe(true);
  });

  it("rejects oversized AI snapshots", () => {
    const big: Record<string, unknown> = { data: "x".repeat(40_000) };
    expect(() => validateAISnapshotSize(big)).toThrow();
  });
});
