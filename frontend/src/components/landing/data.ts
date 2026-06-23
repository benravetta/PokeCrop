export const BEFORE_IMG = "/demo-before.jpg?v=oddish4";
export const AFTER_IMG = "/demo-after.png?v=oddish4";

export const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "The report", href: "#report" },
  { label: "Reviews", href: "#reviews" },
  { label: "How it works", href: "#how" },
  { label: "Pricing", href: "#pricing" },
] as const;

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
    text: "Submitted three cards to PSA last year that came back lower than I hoped. GemCheck flagged the corner wear on my Charizard before I wasted another £30. Honestly wish I'd had this sooner.",
  },
  {
    name: "Sarah K.",
    location: "Bristol",
    role: "eBay seller",
    rating: 5,
    text: "I run a small shop listing 20–30 cards a week. The crop tool alone saves me an hour of Photoshop. The grade check helps me price raw vs slabbed listings properly.",
  },
  {
    name: "Marcus L.",
    location: "Glasgow",
    role: "Vintage Pokémon collector",
    rating: 5,
    text: "The report told me my Gym Heroes Oddish was a CGC card, not a PSA card — centring was the issue, not the surface. Sent it to CGC and got an 8.5. Spot on.",
  },
  {
    name: "Priya M.",
    location: "London",
    role: "First-time submitter",
    rating: 4,
    text: "I'd never graded before and had no idea what 'gem mint' actually meant for my cards. The prep checklist was genuinely useful — fixed two tiny issues before I posted them off.",
  },
  {
    name: "Dan W.",
    location: "Card show regular",
    role: "Trader",
    rating: 5,
    text: "Quick check on the table before I buy. If the report says 'sell raw', I don't overpay. Simple as that. Works on my phone photos too.",
  },
  {
    name: "Helen C.",
    location: "Manchester",
    role: "Parent & collector",
    rating: 5,
    text: "My son wanted to grade his binder finds. GemCheck showed us which three were actually worth the postage. The PDF report made it easy to explain why to a twelve-year-old.",
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
    cta: "Start free",
    ctaTo: "/register",
  },
  {
    id: "unlimited",
    name: "Unlimited",
    price: "£7.99",
    period: "per month",
    highlight: true,
    features: ["Unlimited crops", "Up to 10 grades per day", "Priority processing", "Everything in Free"],
    cta: "Go Unlimited",
    ctaTo: "/pricing",
  },
  {
    id: "api",
    name: "API",
    price: "£19.99",
    period: "per month",
    highlight: false,
    features: ["Everything in Unlimited", "REST API access", "20 API grades per day", "Bulk crop automation"],
    cta: "View API plan",
    ctaTo: "/pricing",
  },
] as const;

export const API_SNIPPET = `curl -X POST https://gemcheck.co.uk/v1/crop \\
  -H "Authorization: Bearer $GEMCHECK_API_KEY" \\
  -H "Accept: image/png" \\
  -F "image=@charizard.jpg" \\
  -o cropped.png

curl -X POST https://gemcheck.co.uk/v1/grade \\
  -H "Authorization: Bearer $GEMCHECK_API_KEY" \\
  -F "front=@front.jpg" -F "back=@back.jpg"`;
