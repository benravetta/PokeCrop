import { describe, expect, it } from "vitest";
import {
  buildAdminInviteEmail,
  buildAppNotificationEmail,
  wrapGemCheckEmail,
} from "./gemcheckEmail.js";

describe("gemcheckEmail", () => {
  it("wraps content in the shared GemCheck layout", () => {
    const html = wrapGemCheckEmail("<p>Hello</p>", "Preview text");
    expect(html).toContain("gemcheck-logo-dark.png");
    expect(html).toContain("Know the grade before you submit");
    expect(html).toContain("GemCheck by Looky Collectibles");
    expect(html).toContain("Preview text");
    expect(html).toContain("<p>Hello</p>");
  });

  it("builds admin invite emails matching Supabase invite styling", () => {
    const { subject, html, preheader } = buildAdminInviteEmail({
      registerUrl: "https://gemcheck.co.uk/register?invite=abc",
      role: "admin",
    });
    expect(subject).toBe("You're invited to GemCheck");
    expect(preheader).toContain("invited");
    expect(html).toContain("You're invited to GemCheck");
    expect(html).toContain("administrator");
    expect(html).toContain("Accept invitation");
    expect(html).toContain("register?invite=abc");
  });

  it("builds app notification emails with optional CTA", () => {
    const { html, subject } = buildAppNotificationEmail({
      title: "Your collector profile is live",
      body: "Your profile is now published.",
      ctaHref: "https://gemcheck.co.uk/u/trader",
      ctaLabel: "View your profile",
    });
    expect(subject).toBe("Your collector profile is live");
    expect(html).toContain("Your collector profile is live");
    expect(html).toContain("View your profile");
    expect(html).toContain("/u/trader");
  });
});
