import { SINGLE_REPORT_PRICE } from "../../lib/marketingCopy";

export const BEFORE_IMG = "/demo-before.jpg?v=oddish4";
export const AFTER_IMG = "/demo-after.png?v=oddish4";
/** Raw desk photo — input to the crop pipeline. */
export const HERO_CARD_BEFORE = "/demo-charizard.png";
/** Cropped output from GemCheck (detect → straighten → transparent PNG). */
export const HERO_CARD_IMG = "/demo-charizard-crop.png";

/** Illustrative grader estimates for the Oddish sample report (one shared condition read). */
export const EXAMPLE_COMPANIES = [
  {
    name: "PSA",
    likely: "8",
    low: "7",
    high: "9",
    subgrades: null,
    note: "Holistic grade. Corner wear likely caps above 8.",
  },
  {
    name: "Beckett",
    likely: "8.5",
    low: "8",
    high: "9",
    subgrades: { corners: "8.5", centering: "8", edges: "9", surface: "8.5" },
    bestFit: true,
  },
  {
    name: "CGC",
    likely: "8.5",
    low: "8",
    high: "9",
    subgrades: { corners: "9", centering: "8", edges: "8.5", surface: "8.5" },
    bestFit: true,
  },
  {
    name: "ACE",
    likely: "8.0",
    low: "7.5",
    high: "8.5",
    subgrades: { corners: "8.5", centering: "7.5", edges: "8", surface: "8.5" },
  },
  {
    name: "TAG",
    likely: "8.2",
    low: "7.6",
    high: "8.8",
    subgrades: { corners: "8.4", centering: "7.8", edges: "8.3", surface: "8.5" },
  },
] as const;

export type ExampleCompany = (typeof EXAMPLE_COMPANIES)[number];

export const SUBGRADE_KEYS = ["corners", "centering", "edges", "surface"] as const;

/** Demo data for the Compare estimates section (Oddish report, distinct from hero Charizard). */
export const GRADER_COMPARE_DEMO = {
  card: "Erika's Oddish",
  set: "Gym Heroes · 1st Edition · 52/132",
  thumb: AFTER_IMG,
  subgradeLabels: ["Corners", "Centering", "Edges", "Surface"] as const,
  bestFit: "CGC or Beckett",
  bestFitReason:
    "Strong edges and surface, but rear corner whitening limits a gem mint. Both score borderline centering more generously than PSA.",
  confidence: "Moderate confidence",
} as const;

export function formatExampleSubgrades(c: ExampleCompany): string {
  if (!c.subgrades) return "Holistic (no subgrades)";
  const s = c.subgrades;
  return `${s.corners}  /  ${s.centering}  /  ${s.edges}  /  ${s.surface}`;
}

export function getExampleSubgrade(c: ExampleCompany, key: (typeof SUBGRADE_KEYS)[number]): string | null {
  return c.subgrades?.[key] ?? null;
}

export const EX_IDENT: [string, string][] = [
  ["Set", "Gym Heroes"],
  ["No.", "52 / 132"],
  ["Rarity", "Common"],
  ["Variant", "Non-holo"],
  ["Edition", "1st Edition"],
  ["Language", "English"],
  ["Illus.", "Kagemaru Himeno"],
];

export const EX_SCORES = [
  { label: "Corners", score: 7.5, verdict: "Light whitening on the rear top-left corner." },
  { label: "Edges", score: 8.0, verdict: "Minor wear along the right border." },
  { label: "Surface", score: 8.5, verdict: "One faint scuff visible under glare." },
  { label: "Eye appeal", score: 8.0, verdict: "Clean, bright and well printed." },
] as const;

export const PRICING_TIERS = [
  {
    id: "free",
    name: "Free",
    price: "£0",
    period: "forever",
    highlight: false,
    features: [
      "3 crops per day",
      "1 pre-grade report per month",
      "Full PDF reports",
      "All 5 grading companies",
    ],
    cta: "Check a card free",
    ctaTo: "/register",
  },
  {
    id: "unlimited",
    name: "Premium",
    price: "£9.99",
    period: "per month",
    highlight: true,
    features: [
      "Unlimited crops",
      "30 pre-grade reports per month",
      "Full PDF reports",
      "All 5 grading companies",
    ],
    cta: "Go Premium",
    ctaTo: "/pricing",
  },
  {
    id: "pro",
    name: "Pro",
    price: "£19.99",
    period: "per month",
    highlight: false,
    features: [
      "Everything in Premium",
      "100 pre-grade reports per month",
      "Priority processing",
      "Buy extra reports anytime",
    ],
    cta: "Go Pro",
    ctaTo: "/pricing",
  },
  {
    id: "api",
    name: "Enterprise",
    price: "£29.99",
    period: "per month",
    highlight: false,
    features: [
      "Everything in Pro",
      "REST API access",
      "Self-serve API keys",
      "Bulk crop automation",
    ],
    cta: "View Enterprise",
    ctaTo: "/pricing",
  },
] as const;

export const SINGLE_GRADE = {
  price: SINGLE_REPORT_PRICE,
  features: [
    "One full pre-grade PDF report",
    "All 5 grading companies compared",
    "Prep checklist included",
    "No subscription. Credit stays on your account",
  ],
} as const;

export const API_SNIPPET = `curl -X POST https://gemcheck.co.uk/v1/crop \\
  -H "Authorization: Bearer $GEMCHECK_API_KEY" \\
  -H "Accept: image/png" \\
  -F "image=@charizard.jpg" \\
  -o cropped.png

curl -X POST https://gemcheck.co.uk/v1/grade \\
  -H "Authorization: Bearer $GEMCHECK_API_KEY" \\
  -F "front=@front.jpg" -F "back=@back.jpg"`;
