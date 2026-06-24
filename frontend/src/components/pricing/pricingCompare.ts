import { SINGLE_GRADE } from "../landing/data";
import { PLAN_LABELS, type Plan } from "../../lib/plans";

export type PlanColumn = "free" | "unlimited" | "pro" | "api" | "single";

export type CompareCell = boolean | string;

export interface CompareRow {
  label: string;
  hint?: string;
  free: CompareCell;
  unlimited: CompareCell;
  pro: CompareCell;
  api: CompareCell;
  single: CompareCell;
}

export interface CompareSection {
  title: string;
  rows: CompareRow[];
}

/** Pro launch offer — coupon must exist in Stripe as promotion code GEM50. */
export const PRO_LAUNCH_PROMO = {
  code: "GEM50",
  headline: "50% off for 3 months",
  detail: "New customers only · enter GEM50 at checkout · offer ends 1 Aug 2026",
  activeUntil: "2026-08-01",
} as const;

export function isProLaunchPromoActive(now = new Date()): boolean {
  return now < new Date(`${PRO_LAUNCH_PROMO.activeUntil}T23:59:59Z`);
}

export const PLAN_COLUMNS: {
  id: PlanColumn;
  name: string;
  price: string;
  cadence?: string;
}[] = [
  { id: "free", name: PLAN_LABELS.free, price: "£0", cadence: "forever" },
  { id: "unlimited", name: PLAN_LABELS.unlimited, price: "£9.99", cadence: "/mo" },
  { id: "pro", name: PLAN_LABELS.pro, price: "£19.99", cadence: "/mo" },
  { id: "api", name: PLAN_LABELS.api, price: "£29.99", cadence: "/mo" },
  { id: "single", name: "Pay as you go", price: SINGLE_GRADE.price, cadence: "one-time" },
];

export const SUBSCRIPTION_TIERS = [
  {
    id: "free" as const,
    name: PLAN_LABELS.free,
    price: "£0",
    cadence: "forever",
    blurb: "Try straightening, centring and pre-grading before you commit to a subscription.",
    highlight: false,
    promo: null as string | null,
    features: [
      "3 crop & centring sessions per day",
      "1 pre-grade report per month",
      "Full PDF reports & prep checklist",
      "All 5 grading companies compared",
      "Manual crop editor, centring tool & exports",
    ],
  },
  {
    id: "unlimited" as const,
    name: PLAN_LABELS.unlimited,
    price: "£9.99",
    cadence: "/mo",
    blurb: "For collectors who straighten, measure centring and check cards regularly.",
    highlight: true,
    promo: null,
    features: [
      "Unlimited crop & centring every day",
      "30 pre-grade reports per month",
      "Full PDF reports & prep checklist",
      "All 5 grading companies compared",
      "Buy extra grades anytime",
    ],
  },
  {
    id: "pro" as const,
    name: PLAN_LABELS.pro,
    price: "£19.99",
    cadence: "/mo",
    blurb: "For sellers and serious collectors grading at volume.",
    highlight: false,
    promo: PRO_LAUNCH_PROMO.headline,
    features: [
      "Everything in Premium",
      "100 pre-grade reports per month",
      "Priority processing",
      "Buy extra grades anytime",
    ],
  },
  {
    id: "api" as const,
    name: PLAN_LABELS.api,
    price: "£29.99",
    cadence: "/mo",
    blurb: "Pro features plus REST API access for shops and automation.",
    highlight: false,
    promo: null,
    features: [
      "Everything in Pro",
      "REST API for crop & grade",
      "Self-serve API keys",
      "Bulk crop automation",
      "100 pre-grades per month (web + API)",
    ],
  },
];

export const COMPARE_SECTIONS: CompareSection[] = [
  {
    title: "Crop & centring",
    rows: [
      {
        label: "Daily web crop & centring sessions",
        free: "3 per day",
        unlimited: "Unlimited",
        pro: "Unlimited",
        api: "Unlimited",
        single: "—",
      },
      {
        label: "Manual crop editor",
        free: true,
        unlimited: true,
        pro: true,
        api: true,
        single: "—",
      },
      {
        label: "Original & web PNG exports",
        free: true,
        unlimited: true,
        pro: true,
        api: true,
        single: "—",
      },
      {
        label: "Send cropped card to grader",
        free: true,
        unlimited: true,
        pro: true,
        api: true,
        single: "—",
      },
      {
        label: "Border centring measurement",
        hint: "On the straightened crop and in Grade",
        free: true,
        unlimited: true,
        pro: true,
        api: true,
        single: "—",
      },
      {
        label: "Crop history with centring & detect scores",
        hint: "Searchable in History",
        free: true,
        unlimited: true,
        pro: true,
        api: true,
        single: "—",
      },
      {
        label: "REST API crop endpoint",
        hint: "Programmatic cropping for automation",
        free: false,
        unlimited: false,
        pro: false,
        api: true,
        single: false,
      },
    ],
  },
  {
    title: "Pre-grade",
    rows: [
      {
        label: "Reports included",
        free: "1 / month",
        unlimited: "30 / month",
        pro: "100 / month",
        api: "100 / month",
        single: "1 per purchase",
      },
      {
        label: "All 5 grading companies",
        hint: "PSA, Beckett, CGC, ACE & TAG",
        free: true,
        unlimited: true,
        pro: true,
        api: true,
        single: true,
      },
      {
        label: "Full PDF report download",
        free: true,
        unlimited: true,
        pro: true,
        api: true,
        single: true,
      },
      {
        label: "Prep checklist & flaw notes",
        free: true,
        unlimited: true,
        pro: true,
        api: true,
        single: true,
      },
      {
        label: "Border centring measurement",
        hint: "On the straightened crop and in Grade",
        free: true,
        unlimited: true,
        pro: true,
        api: true,
        single: true,
      },
      {
        label: "Rough value ranges",
        free: true,
        unlimited: true,
        pro: true,
        api: true,
        single: true,
      },
      {
        label: "Purchased credits stack",
        hint: "Pay-as-you-go grades add to your allowance",
        free: true,
        unlimited: true,
        pro: true,
        api: true,
        single: true,
      },
      {
        label: "REST API grade endpoint",
        free: false,
        unlimited: false,
        pro: false,
        api: true,
        single: false,
      },
    ],
  },
  {
    title: "Platform",
    rows: [
      {
        label: "Priority processing",
        free: false,
        unlimited: false,
        pro: true,
        api: true,
        single: false,
      },
      {
        label: "Self-serve API keys",
        free: false,
        unlimited: false,
        pro: false,
        api: true,
        single: false,
      },
      {
        label: "Usage & report history",
        free: true,
        unlimited: true,
        pro: true,
        api: true,
        single: true,
      },
      {
        label: "Cancel any time",
        free: "—",
        unlimited: true,
        pro: true,
        api: true,
        single: "—",
      },
    ],
  },
];

export const PRICING_FAQ = [
  {
    q: "What's included in a single £2.99 grade?",
    a: "The same full pre-grade report you get on a subscription — all five companies, condition scores, centring, prep checklist, and a downloadable PDF. The credit stays on your account until you use it.",
  },
  {
    q: "Do pay-as-you-go grades expire?",
    a: "No. Purchased credits remain on your account until you run a report. They stack on top of your free monthly grade or subscription allowance.",
  },
  {
    q: "How does the Pro launch offer work?",
    a: "New customers can enter promotion code GEM50 at checkout for 50% off Pro for the first three months. The offer ends 1 August 2026. Configure the coupon in Stripe with new-customer and duration restrictions.",
  },
  {
    q: "What's the difference between Pro and Enterprise?",
    a: "Pro includes 100 web pre-grades per month and priority processing. Enterprise adds everything in Pro plus REST API access, self-serve API keys, and programmatic crop & grade endpoints.",
  },
  {
    q: "What counts toward my crop limit?",
    a: "Each successful straighten/crop on the web app counts toward your daily free limit (centring measurement on the same session is included). Failed detections don't. Premium, Pro, and Enterprise include unlimited web crops.",
  },
] as const;

export type SubscriptionPlanId = Exclude<Plan, "free">;
