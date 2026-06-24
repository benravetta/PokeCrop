/** Shared marketing-site navigation — single source of truth for headers and footers. */

export type SiteNavItem = {
  label: string;
  href: string;
  external?: boolean;
};

/** Core product pages — shown in the site menu on all screen sizes. */
export const HEADER_NAV_LINKS: SiteNavItem[] = [
  { label: "How it works", href: "/how-it-works" },
  { label: "Pricing", href: "/pricing" },
  { label: "FAQ", href: "/faq" },
  { label: "About", href: "/about" },
  { label: "Trade", href: "/trade" },
  { label: "Contact", href: "/contact" },
];

/** Developer entry — appended after primary links in the menu. */
export const HEADER_RESOURCE_LINKS: SiteNavItem[] = [
  { label: "API", href: "/docs" },
];

export const FOOTER_UTILITY_LINKS: SiteNavItem[] = [
  { label: "Sign in", href: "/login" },
];

export const FOOTER_EXTERNAL_LINKS: SiteNavItem[] = [
  {
    label: "A Looky Collectibles tool",
    href: "https://getlooky.uk",
    external: true,
  },
];

/** All in-app footer links in display order. */
export const FOOTER_NAV_LINKS: SiteNavItem[] = [
  ...HEADER_NAV_LINKS,
  { label: "API docs", href: "/docs" },
  ...FOOTER_UTILITY_LINKS,
];
