import { SINGLE_GRADE } from "../landing/data";

export type PlanColumn = "free" | "unlimited" | "api" | "single";

export type CompareCell = boolean | string;

export interface CompareRow {
  label: string;
  hint?: string;
  free: CompareCell;
  unlimited: CompareCell;
  api: CompareCell;
  single: CompareCell;
}

export interface CompareSection {
  title: string;
  rows: CompareRow[];
}

export const PLAN_COLUMNS: {
  id: PlanColumn;
  name: string;
  price: string;
  cadence?: string;
}[] = [
  { id: "free", name: "Free", price: "£0", cadence: "forever" },
  { id: "unlimited", name: "Unlimited", price: "£7.99", cadence: "/mo" },
  { id: "api", name: "API", price: "£19.99", cadence: "/mo" },
  { id: "single", name: "Pay as you go", price: SINGLE_GRADE.price, cadence: "one-time" },
];

export const SUBSCRIPTION_TIERS = [
  {
    id: "free" as const,
    name: "Free",
    price: "£0",
    cadence: "forever",
    blurb: "Try cropping and pre-grading before you commit to a subscription.",
    highlight: false,
    features: [
      "3 crops per day",
      "1 pre-grade report per month",
      "Full PDF reports & prep checklist",
      "All 5 grading companies compared",
      "Manual crop editor & exports",
    ],
  },
  {
    id: "unlimited" as const,
    name: "Unlimited",
    price: "£7.99",
    cadence: "/mo",
    blurb: "For collectors and sellers who crop and check cards regularly.",
    highlight: true,
    features: [
      "Unlimited crops every day",
      "Up to 10 pre-grades per day",
      "Priority processing",
      "Everything in Free",
      "Buy extra grades anytime",
    ],
  },
  {
    id: "api" as const,
    name: "API access",
    price: "£19.99",
    cadence: "/mo",
    blurb: "Automate cropping and pre-grading in your own tools and workflows.",
    highlight: false,
    features: [
      "Everything in Unlimited",
      "REST API for crop & grade",
      "20 API pre-grades per day",
      "Self-serve API keys",
      "Bulk crop automation",
    ],
  },
];

export const COMPARE_SECTIONS: CompareSection[] = [
  {
    title: "Crop",
    rows: [
      {
        label: "Daily web crops",
        free: "3 per day",
        unlimited: "Unlimited",
        api: "Unlimited",
        single: "—",
      },
      {
        label: "Manual crop editor",
        free: true,
        unlimited: true,
        api: true,
        single: "—",
      },
      {
        label: "Original & web PNG exports",
        free: true,
        unlimited: true,
        api: true,
        single: "—",
      },
      {
        label: "Send cropped card to grader",
        free: true,
        unlimited: true,
        api: true,
        single: "—",
      },
      {
        label: "REST API crop endpoint",
        hint: "Programmatic cropping for automation",
        free: false,
        unlimited: false,
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
        unlimited: "10 / day",
        api: "20 / day (API)",
        single: "1 per purchase",
      },
      {
        label: "All 5 grading companies",
        hint: "PSA, Beckett, CGC, ACE & TAG",
        free: true,
        unlimited: true,
        api: true,
        single: true,
      },
      {
        label: "Full PDF report download",
        free: true,
        unlimited: true,
        api: true,
        single: true,
      },
      {
        label: "Prep checklist & flaw notes",
        free: true,
        unlimited: true,
        api: true,
        single: true,
      },
      {
        label: "Centering measurement tool",
        free: true,
        unlimited: true,
        api: true,
        single: true,
      },
      {
        label: "Rough value ranges",
        free: true,
        unlimited: true,
        api: true,
        single: true,
      },
      {
        label: "Purchased credits stack",
        hint: "Pay-as-you-go grades add to your allowance",
        free: true,
        unlimited: true,
        api: true,
        single: true,
      },
      {
        label: "REST API grade endpoint",
        free: false,
        unlimited: false,
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
        unlimited: true,
        api: true,
        single: false,
      },
      {
        label: "Self-serve API keys",
        free: false,
        unlimited: false,
        api: true,
        single: false,
      },
      {
        label: "Usage & report history",
        free: true,
        unlimited: true,
        api: true,
        single: true,
      },
      {
        label: "Cancel any time",
        free: "—",
        unlimited: true,
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
    a: "No. Purchased credits remain on your account until you run a report. They stack on top of your free monthly grade or daily subscription allowance.",
  },
  {
    q: "Can I use the API on Unlimited?",
    a: "API access requires the £19.99/mo API plan. Unlimited covers unlimited web crops and up to 10 web pre-grades per day.",
  },
  {
    q: "What counts toward my crop limit?",
    a: "Each successful crop on the web app counts toward your daily free limit. Failed detections don't. Unlimited and API plans have no daily web crop cap.",
  },
] as const;
