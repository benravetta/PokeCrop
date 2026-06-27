import { SINGLE_GRADE } from "../landing/data";
import { PLAN_LABELS, type Plan } from "../../lib/plans";
import { FREE_GRADES_PER_MONTH, SINGLE_REPORT_PRICE } from "../../lib/marketingCopy";

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
      `${FREE_GRADES_PER_MONTH} pre-grade reports per month`,
      "Collector profile, trade lists & messaging",
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
      "Collector profile, trade lists & messaging",
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
      "Collector profile, trade lists & messaging",
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
      "Collector profile, trade lists & messaging",
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
        label: "Watermark-free exports",
        hint: "Paid plans remove the GemCheck watermark from crop PNGs and PDF reports",
        free: false,
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
        free: `${FREE_GRADES_PER_MONTH} / month`,
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
        hint: "Free plan PDFs include a GemCheck watermark",
        free: true,
        unlimited: true,
        pro: true,
        api: true,
        single: true,
      },
      {
        label: "Watermark-free PDF reports",
        free: false,
        unlimited: true,
        pro: true,
        api: true,
        single: "—",
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
  {
    title: "Collector profiles",
    rows: [
      {
        label: "Public profile & shareable link",
        hint: "Your collector page at gemcheck.co.uk/u/username",
        free: true,
        unlimited: true,
        pro: true,
        api: true,
        single: true,
      },
      {
        label: "Showcase, for trade & wanted lists",
        free: true,
        unlimited: true,
        pro: true,
        api: true,
        single: true,
      },
      {
        label: "Trade enquiries & messaging",
        hint: "Structured offers and private in-app messages",
        free: true,
        unlimited: true,
        pro: true,
        api: true,
        single: true,
      },
      {
        label: "Pre-grade cards on your profile",
        hint: "Uses the same monthly allowance or credits as web pre-grades",
        free: `${FREE_GRADES_PER_MONTH} / month`,
        unlimited: "30 / month",
        pro: "100 / month",
        api: "100 / month",
        single: "1 per purchase",
      },
      {
        label: "Grade another collector's public card",
        hint: "Uses your allowance — does not change the owner's listing",
        free: true,
        unlimited: true,
        pro: true,
        api: true,
        single: true,
      },
    ],
  },
];

export const PRICING_FAQ = [
  {
    q: "What's included in a single £2.99 report?",
    a: "The same full pre-grade report you get on a subscription: all five companies, condition scores, centring, prep checklist and a downloadable PDF. The credit stays on your account until you use it.",
  },
  {
    q: "Do pay-as-you-go credits expire?",
    a: "No. Purchased credits remain on your account until you run a report. They stack on top of your free monthly allowance or subscription.",
  },
  {
    q: "Do I need a subscription?",
    a: `No. Your free account includes ${FREE_GRADES_PER_MONTH} card checks per month. Extra reports start at ${SINGLE_REPORT_PRICE}. Subscriptions are optional for heavier use.`,
  },
  {
    q: "What happens if a photo is rejected?",
    a: "If photo quality blocks the check, or the image is not a trading card, your report credit is not used. Retake the photo and try again.",
  },
  {
    q: "What counts towards my crop limit?",
    a: "Each successful straighten/crop on the web app counts towards your daily free limit. Failed detections do not. Premium, Pro and Enterprise include unlimited web crops.",
  },
  {
    q: "How does the Pro launch offer work?",
    a: "New customers can enter promotion code GEM50 at checkout for 50% off Pro for the first three months. The offer ends 1 August 2026.",
  },
  {
    q: "What's the difference between Pro and Enterprise?",
    a: "Pro includes 100 web pre-grade reports per month and priority processing. Enterprise adds REST API access, self-serve API keys and programmatic crop and grade endpoints.",
  },
  {
    q: "Can I request a refund?",
    a: "Unused purchased report credits can be refunded through Stripe when eligible. See our refund policy for details.",
  },
] as const;

export type SubscriptionPlanId = Exclude<Plan, "free">;
