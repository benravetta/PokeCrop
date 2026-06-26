import { describe, expect, it } from "vitest";
import { isBetaInviteRequired } from "./invites.js";

describe("isBetaInviteRequired", () => {
  it("is false unless BETA_INVITE_REQUIRED=true", () => {
    const prev = process.env.BETA_INVITE_REQUIRED;
    delete process.env.BETA_INVITE_REQUIRED;
    expect(isBetaInviteRequired()).toBe(false);
    process.env.BETA_INVITE_REQUIRED = "true";
    expect(isBetaInviteRequired()).toBe(true);
    if (prev === undefined) delete process.env.BETA_INVITE_REQUIRED;
    else process.env.BETA_INVITE_REQUIRED = prev;
  });
});

describe("normalizeInviteEmail", () => {
  it("rejects invalid addresses", async () => {
    const { normalizeInviteEmail } = await import("./invites.js");
    expect(normalizeInviteEmail("not-an-email")).toBeNull();
    expect(normalizeInviteEmail("a\r@b.com")).toBeNull();
    expect(normalizeInviteEmail("valid@example.com")).toBe("valid@example.com");
  });
});
