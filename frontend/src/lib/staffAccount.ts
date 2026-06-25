import type { MeResponse } from "./api";

/** Staff (admin role) accounts — full access, no billing. */
export function isStaffAccount(me: MeResponse | null | undefined): boolean {
  return me?.isAdmin === true;
}

export const STAFF_ACCOUNT = {
  accountSectionTitle: "Access",
  accountBody: "Staff account with full platform access.",
  accountNote: "Billing and plan changes are not available on staff accounts.",
  pricingFootnote: "Pricing below is for customer accounts.",
  planCardLabel: "Included",
  heroSupport: "Full platform access.",
  planCta: {
    title: "Ready to check a card?",
    copy: "Open the app or manage API keys from your account.",
    primary: "Open app",
    secondary: "Ops console",
  },
  apiCta: "Manage API keys",
} as const;
