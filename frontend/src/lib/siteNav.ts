/** Shared marketing-site navigation — single source of truth for headers and footers. */

import { NAV, SAMPLE_REPORT_PATH } from "./marketingCopy";

export type SiteNavItem = {
  label: string;
  href: string;
  external?: boolean;
};

export type SiteNavGroup = {
  label: string;
  links: SiteNavItem[];
};

/** Flat list for footers and simple menus. */
export const HEADER_NAV_LINKS: SiteNavItem[] = [
  { label: "How it works", href: "/how-it-works" },
  { label: NAV.sampleReport, href: SAMPLE_REPORT_PATH },
  { label: "Pricing", href: "/pricing" },
  { label: "FAQ", href: "/faq" },
  { label: "About", href: "/about" },
  { label: "Trade", href: "/trade" },
  { label: "Contact", href: "/contact" },
];

export const HEADER_RESOURCE_LINKS: SiteNavItem[] = [
  { label: "API docs", href: "/docs" },
];

/** Grouped layout for the compact desktop menu panel. */
export const NAV_MENU_GROUPS: SiteNavGroup[] = [
  {
    label: "Product",
    links: [
      { label: "How it works", href: "/how-it-works" },
      { label: NAV.sampleReport, href: SAMPLE_REPORT_PATH },
      { label: "Pricing", href: "/pricing" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  {
    label: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Trade", href: "/trade" },
      { label: "Contact", href: "/contact" },
    ],
  },
];

export const FOOTER_UTILITY_LINKS: SiteNavItem[] = [
  { label: "Sign in", href: "/login" },
];

/** Placeholder until legal pages are published. */
export const FOOTER_LEGAL_LINKS: SiteNavItem[] = [
  { label: "Privacy policy (TODO)", href: "/privacy" },
  { label: "Terms (TODO)", href: "/terms" },
  { label: "Refunds (TODO)", href: "/refund" },
];

export const FOOTER_EXTERNAL_LINKS: SiteNavItem[] = [
  {
    label: "A Looky Collectibles tool",
    href: "https://getlooky.uk",
    external: true,
  },
];

export const FOOTER_NAV_LINKS: SiteNavItem[] = [
  ...HEADER_NAV_LINKS,
  ...HEADER_RESOURCE_LINKS,
  ...FOOTER_UTILITY_LINKS,
  ...FOOTER_LEGAL_LINKS,
];
