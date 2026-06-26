import { describe, expect, it, beforeEach } from "vitest";
import { clearAppSettingsCache, isBetaInviteRequiredFromEnv } from "./appSettings.js";

describe("isBetaInviteRequiredFromEnv", () => {
  beforeEach(() => {
    clearAppSettingsCache();
  });

  it("is false unless BETA_INVITE_REQUIRED=true", () => {
    const prev = process.env.BETA_INVITE_REQUIRED;
    delete process.env.BETA_INVITE_REQUIRED;
    expect(isBetaInviteRequiredFromEnv()).toBe(false);
    process.env.BETA_INVITE_REQUIRED = "true";
    expect(isBetaInviteRequiredFromEnv()).toBe(true);
    if (prev === undefined) delete process.env.BETA_INVITE_REQUIRED;
    else process.env.BETA_INVITE_REQUIRED = prev;
  });
});
