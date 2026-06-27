import { describe, expect, it } from "vitest";
import { validateUsername, normalizeUsername } from "../domain/username.js";
import { RESERVED_USERNAMES } from "../domain/reservedUsernames.js";
import {
  isProfilePubliclyAccessible,
  effectiveCardVisibility,
  canAnonymousViewCard,
  shouldNoIndex,
} from "../domain/visibility.js";
import { isCollectorProfilesEnvEnabled } from "../domain/featureFlag.js";

describe("username validation", () => {
  it("normalizes to lowercase", () => {
    expect(normalizeUsername("My_User")).toBe("my_user");
  });

  it("accepts valid usernames", () => {
    expect(validateUsername("poke_trader_42").ok).toBe(true);
  });

  it("rejects short usernames", () => {
    expect(validateUsername("ab").ok).toBe(false);
  });

  it("rejects reserved usernames", () => {
    for (const name of ["admin", "gemcheck", "trade"]) {
      expect(validateUsername(name).ok).toBe(false);
      expect(RESERVED_USERNAMES.has(name)).toBe(true);
    }
  });

  it("rejects profanity", () => {
    expect(validateUsername("shithead").ok).toBe(false);
  });
});

describe("visibility", () => {
  it("public active profiles are accessible", () => {
    expect(isProfilePubliclyAccessible("public", "active")).toBe(true);
    expect(isProfilePubliclyAccessible("private", "active")).toBe(false);
    expect(isProfilePubliclyAccessible("public", "draft")).toBe(false);
  });

  it("inherits profile visibility onto cards", () => {
    expect(effectiveCardVisibility("public", "private")).toBe("private");
    expect(effectiveCardVisibility("public", "unlisted")).toBe("unlisted");
  });

  it("blocks anonymous card view for private profiles", () => {
    expect(canAnonymousViewCard("public", "private", "active", "active")).toBe(false);
    expect(canAnonymousViewCard("public", "public", "active", "active")).toBe(true);
  });

  it("noindex for unlisted or when indexing disabled", () => {
    expect(shouldNoIndex("unlisted", true)).toBe(true);
    expect(shouldNoIndex("public", false)).toBe(true);
    expect(shouldNoIndex("public", true)).toBe(false);
  });
});

describe("feature flag env", () => {
  it("reads COLLECTOR_PROFILES_ENABLED", () => {
    const prev = process.env.COLLECTOR_PROFILES_ENABLED;
    process.env.COLLECTOR_PROFILES_ENABLED = "1";
    expect(isCollectorProfilesEnvEnabled()).toBe(true);
    process.env.COLLECTOR_PROFILES_ENABLED = prev;
  });
});
