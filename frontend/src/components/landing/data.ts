export const BEFORE_IMG = "/demo-before.jpg?v=oddish4";
export const AFTER_IMG = "/demo-after.png?v=oddish4";
/** Raw desk photo — input to the crop pipeline. */
export const HERO_CARD_BEFORE = "/demo-charizard.png";
/** Cropped output from GemCheck (detect → straighten → transparent PNG). */
export const HERO_CARD_IMG = "/demo-charizard-crop.png";

export const NAV_LINKS = [
  { label: "How it works", href: "/how-it-works" },
  { label: "Pricing", href: "/pricing" },
  { label: "FAQ", href: "/faq" },
  { label: "Trade", href: "/trade" },
] as const;

export const HERO_REVIEW = {
  name: "Marcus L.",
  role: "Vintage Pokémon collector, Glasgow",
  rating: 5 as const,
  text: "Centreing was the limiter — the report steered me toward CGC instead of PSA. Exactly the nudge I needed before paying for a submission.",
};

export const STATS = [
  { value: "12,400+", label: "cards checked" },
  { value: "£38", label: "avg. saved per submission" },
  { value: "5", label: "grading companies compared" },
  { value: "< 2 min", label: "photo to full report" },
] as const;

export const REVIEWS = [
  {
    name: "Tom R.",
    location: "Leeds",
    role: "Weekend collector",
    rating: 5,
    text: "Flagged corner wear on my Charizard before I wasted another £30 on a PSA submission. Wish I'd had this sooner.",
  },
  {
    name: "Sarah K.",
    location: "Bristol",
    role: "eBay seller",
    rating: 5,
    text: "The crop tool saves me an hour of Photoshop a week. The grade check helps me price raw vs slabbed listings properly.",
  },
  {
    name: "Priya M.",
    location: "London",
    role: "First-time submitter",
    rating: 4,
    text: "I'd never graded before. The prep checklist was genuinely useful — fixed two tiny issues before I posted them off.",
  },
] as const;

export const EXAMPLE_COMPANIES = [
  { name: "PSA", likely: "8", low: "7", high: "9", subs: ["8", "7.5", "8.5", "8.5"] },
  { name: "Beckett", likely: "8.5", low: "8", high: "9", subs: ["8.5", "8", "9", "8.5"] },
  { name: "CGC", likely: "8.5", low: "8", high: "9", subs: ["9", "8", "8.5", "8.5"] },
  { name: "ACE", likely: "8.0", low: "7.5", high: "8.5", subs: ["8.5", "7.5", "8", "8.5"] },
  { name: "TAG", likely: "8.2", low: "7.6", high: "8.8", subs: ["8.4", "7.8", "8.3", "8.5"] },
] as const;

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
    features: ["3 crops per day", "1 grade report per month", "Full PDF reports", "All 5 grading companies"],
    cta: "Check a card",
    ctaTo: "/register",
  },
  {
    id: "unlimited",
    name: "Premium",
    price: "£9.99",
    period: "per month",
    highlight: true,
    features: ["Unlimited crops", "30 grade reports per month", "Full PDF reports", "All 5 grading companies"],
    cta: "Go Premium",
    ctaTo: "/pricing",
  },
  {
    id: "pro",
    name: "Pro",
    price: "£19.99",
    period: "per month",
    highlight: false,
    features: ["Everything in Premium", "100 grade reports per month", "Priority processing", "Buy extra grades anytime"],
    cta: "Go Pro",
    ctaTo: "/pricing",
  },
  {
    id: "api",
    name: "Enterprise",
    price: "£29.99",
    period: "per month",
    highlight: false,
    features: ["Everything in Pro", "REST API access", "Self-serve API keys", "Bulk crop automation"],
    cta: "View Enterprise",
    ctaTo: "/pricing",
  },
] as const;

export const SINGLE_GRADE = {
  price: "£2.99",
  features: [
    "One full pre-grade PDF report",
    "All 5 grading companies compared",
    "Prep checklist included",
    "No subscription — credit stays on your account",
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
