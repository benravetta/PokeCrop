import { describe, expect, it } from "vitest";
import {
  sanitizeOrderSearchQuery,
  sanitizeCustomerReport,
  validateAISnapshotSize,
  assertValidImageType,
  sanitizeAdminOrder,
  normalizeShareToken,
  shareTokensEqual,
} from "../api/security.js";
import { assertMaxLength, MAX_MESSAGE_BYTES } from "../domain/limits.js";
import { rejectAdminBilling } from "../../lib/adminAccess.js";

describe("security helpers", () => {
  it("strips PostgREST metacharacters from search", () => {
    expect(sanitizeOrderSearchQuery("charizard, user_id.eq.evil")).toBe("charizard user id eq evil");
    expect(sanitizeOrderSearchQuery("a".repeat(200)).length).toBeLessThanOrEqual(100);
  });

  it("strips ILIKE wildcards from search", () => {
    expect(sanitizeOrderSearchQuery("100% match")).toBe("100 match");
    expect(sanitizeOrderSearchQuery("foo_bar")).toBe("foo bar");
  });

  it("rejects invalid image types", () => {
    expect(() => assertValidImageType("evil_type")).toThrow();
    expect(assertValidImageType("front")).toBe("front");
  });

  it("rejects oversized message bodies", () => {
    expect(() => assertMaxLength("x".repeat(MAX_MESSAGE_BYTES + 1), MAX_MESSAGE_BYTES, "Message")).toThrow();
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

  it("redacts reviewer admin order fields", () => {
    const order = {
      id: "1",
      public_id: "pub",
      status: "under_review",
      user_id: "secret-user",
      ai_report_snapshot: { grade: 10 },
      card_name: "Charizard",
    };
    const out = sanitizeAdminOrder(order, false);
    expect(out).not.toHaveProperty("user_id");
    expect(out).not.toHaveProperty("ai_report_snapshot");
    expect(out.has_ai_snapshot).toBe(true);
    expect(out.card_name).toBe("Charizard");
  });

  it("returns full admin order rows for admins", () => {
    const order = { id: "1", user_id: "secret-user" };
    expect(sanitizeAdminOrder(order, true)).toEqual(order);
  });

  it("validates share tokens", () => {
    const valid = "550e8400-e29b-41d4-a716-446655440000";
    expect(normalizeShareToken(valid)).toBe(valid);
    expect(normalizeShareToken("bad")).toBeNull();
    expect(shareTokensEqual(valid, valid)).toBe(true);
    expect(shareTokensEqual(valid, "550e8400-e29b-41d4-a716-446655440001")).toBe(false);
  });

  it("blocks admin billing checkout", () => {
    const res = {
      statusCode: 200,
      body: null as unknown,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: unknown) {
        this.body = payload;
        return this;
      },
    };
    expect(rejectAdminBilling("admin", res as never)).toBe(true);
    expect(res.statusCode).toBe(403);
    expect(rejectAdminBilling("user", res as never)).toBe(false);
  });
});
