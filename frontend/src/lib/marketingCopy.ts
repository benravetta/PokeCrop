/** Shared marketing copy — en-GB, collector-native, estimate-first. SSOT for public site. */

export const SUPPORTED_GRADERS = "PSA, Beckett, CGC, ACE and TAG" as const;
export const SUPPORTED_GRADERS_SHORT = "PSA, Beckett, CGC, ACE, TAG" as const;
export const FREE_GRADES_PER_MONTH = 1;
export const SINGLE_REPORT_PRICE = "£2.99" as const;
export const IMAGE_FORMATS_GRADE = "JPG, PNG, WEBP, HEIC, HEIF or DNG" as const;
export const IMAGE_MAX_SIZE = "50 MB" as const;

export const ESTIMATE_DISCLAIMER =
  "GemCheck provides pre-grade estimates, not official grades. In-person results may differ.";

export const ESTIMATE_DISCLAIMER_LONG =
  "This is a pre-grade estimate based on your photos. It is not an official grade or a guarantee of the result.";

export const ESTIMATE_DISCLAIMER_SHORT =
  "Pre-grade estimate only. Official grade may differ.";

export const GRADER_INDEPENDENCE =
  "GemCheck is an independent pre-grading service and is not affiliated with, endorsed by or approved by any grading company listed on this website.";

export const TRUST_STRIP = [
  "Your card stays with you",
  "Front and back analysed",
  "Five grader estimates",
  "Reasons behind every score",
] as const;

export const HERO = {
  eyebrow: "For Pokémon, sports card and TCG collectors",
  h1: "Know before you grade",
  body: `Upload clear front and back photos to see how your card may grade with ${SUPPORTED_GRADERS}. Get clear reasons behind each estimate before you pay to submit.`,
  primaryCtaGuest: "Check a card free",
  primaryCtaLoggedIn: "Check a card",
  secondaryCta: "View a sample report",
  supportGuest: `1 free card check every month. Extra reports from ${SINGLE_REPORT_PRICE}. No subscription.`,
  supportFreePlan: (singlePrice: string) =>
    `Free plan: 1 card check per month, plus 3 crop sessions a day. Extra reports from ${singlePrice}.`,
  qualification: ESTIMATE_DISCLAIMER,
} as const;

export const PRODUCT_PROOF = {
  kicker: "Before you submit",
  heading: "A second opinion before the submission fee",
  body: "See the likely strengths, weaknesses and grader fit while the card is still in your hands.",
} as const;

export const HOW_IT_WORKS = {
  kicker: "How it works",
  heading: "From photos to a clearer grading decision",
  intro:
    "No posting and no specialist scanner. Upload both sides of the card and GemCheck turns the visible details into a report you can use.",
  steps: [
    {
      title: "Photograph both sides",
      copy: "Place the card flat, show all four corners and use bright, even light. A clear phone photo is enough.",
    },
    {
      title: "We check photo quality",
      copy: "Blur, glare and cropped edges can weaken an estimate. We flag problems so you can retake the photo first.",
    },
    {
      title: "Get your estimates",
      copy: "Compare supported graders and see the likely effect of centering, corners, edges and visible surface condition.",
    },
    {
      title: "Choose your next move",
      copy: "Submit to the grader that looks like the best fit, keep the card raw or save the submission fee.",
    },
  ],
} as const;

export const WHAT_WE_CHECK = {
  kicker: "What we check",
  heading: "See what could hold the grade back",
  intro:
    "GemCheck breaks the visible condition down into the areas collectors and graders care about most.",
  items: [
    {
      label: "Centering",
      copy: "How evenly the artwork and borders sit within the card.",
    },
    {
      label: "Corners",
      copy: "Visible whitening, wear, bends and damage around all four corners.",
    },
    {
      label: "Edges",
      copy: "Chipping, roughness, whitening and visible edge wear.",
    },
    {
      label: "Surface",
      copy: "Scratches, marks, print lines and other issues visible in the photos.",
    },
  ],
  qualification:
    "Some defects, including fine scratches, dents and texture changes, can be difficult to judge from photographs alone.",
} as const;

/** @deprecated use WHAT_WE_CHECK.items */
export const WHAT_WE_CHECK_LEGACY = WHAT_WE_CHECK.items;

export const GRADER_COMPARE = {
  kicker: "Compare estimates",
  heading: "One card. Multiple grading perspectives.",
  body: "GemCheck shows separate pre-grade estimates for each supported grader, so you can compare the likely outcomes side by side.",
  points: [
    {
      title: "Separate grader estimates",
      copy: "Likely grades for PSA, Beckett, CGC, ACE and TAG in one view.",
    },
    {
      title: "Condition breakdown",
      copy: "Centering, corners, edges and surface scored with plain-language notes.",
    },
    {
      title: "Confidence and limits",
      copy: "See when photos support a strong read and when evidence is thin.",
    },
    {
      title: "Likely best fit",
      copy: "A clear recommendation for which grader your card may suit best.",
    },
  ],
  cta: "View a sample report",
} as const;

export const TRANSPARENCY = {
  heading: "Useful guidance, without pretending it is a crystal ball",
  body: "GemCheck estimates how a card may grade using the photographs you provide. It cannot replace physical inspection and it cannot guarantee the grade a company will award.",
  body2:
    "Photo quality, hidden defects and differences in individual assessment can all affect the final result. When GemCheck has limited evidence, the report should say so clearly.",
} as const;

export const PRICING = {
  heading: "Check one free. Pay only when you need more.",
  body: `Your account includes ${FREE_GRADES_PER_MONTH} free card check every month. Extra reports start at ${SINGLE_REPORT_PRICE}, with no subscription required.`,
  vatNote: "TODO: Confirm whether prices include VAT before publishing VAT wording.",
} as const;

export const FOOTER = {
  tagline:
    "GemCheck helps Pokémon, sports card and TCG collectors make more informed grading decisions from clear front and back photographs.",
  location: "Built with care in the English Lake District",
} as const;

export const AUTH = {
  loginSubtitle: "Sign in to check cards and review your reports.",
  registerSubtitle: "Create a free account to check your first card each month.",
  registerBenefit: `${FREE_GRADES_PER_MONTH} free card check every month on the free plan.`,
  alreadyHaveAccount: "Already have an account? Sign in",
  noAccount: "No account yet?",
} as const;

export const PAYMENT = {
  addCheckHeading: "Add another card check",
  oneOffNote: "One-off payment. This will not start a subscription.",
  success: "Your card check is ready",
  failure: "Payment was not completed. You have not been charged.",
  checkoutSuccess: "Payment received. Your card check credit has been added.",
  checkoutCancelled: "Checkout cancelled. You have not been charged.",
} as const;

export const SAMPLE_REPORT_PATH = "/sample-report" as const;

export const NAV = {
  sampleReport: "Sample report",
  signIn: "Sign in",
  checkCardFree: "Check a card free",
  checkCard: "Check a card",
} as const;

export const SITE_FAQ = [
  {
    q: "Is GemCheck an official grading company?",
    a: `No. GemCheck provides pre-grade estimates from card photographs. An official grade can only be issued by the grading company after it physically inspects your card.`,
  },
  {
    q: "Can GemCheck guarantee my grade?",
    a: "No. The report is guidance, not a guarantee. Official results may differ because grading companies inspect cards in person and may see defects that are not visible in photographs.",
  },
  {
    q: "Which grading companies are supported?",
    a: `GemCheck compares pre-grade estimates across ${SUPPORTED_GRADERS}. Each company weights centering, corners, edges and surface differently.`,
  },
  {
    q: "Which cards are supported?",
    a: "GemCheck is built for Pokémon, sports and other TCG cards. Upload clear front and back photos of a single card. If the image is not a trading card, the check stops rather than guessing.",
  },
  {
    q: "What photos do I need?",
    a: "Clear front and back photos showing all four corners. Bright, even light works best. A phone photo on a flat surface is enough.",
  },
  {
    q: "Do I need a scanner?",
    a: "No. A clear phone photograph is enough. Use bright, even light and keep the card flat with all corners visible.",
  },
  {
    q: "Why do estimates differ between graders?",
    a: "Each grading company uses its own standards and weighting. Centering, corners, edges and surface are judged differently, so one card can look stronger with one grader than another.",
  },
  {
    q: "Does GemCheck inspect the physical card?",
    a: "No. The estimate is based entirely on the photographs you upload.",
  },
  {
    q: "Do I need a subscription?",
    a: `No. Your free account includes ${FREE_GRADES_PER_MONTH} card check per month. Extra reports start at ${SINGLE_REPORT_PRICE}. Subscriptions are optional for heavier use.`,
  },
  {
    q: "Where do value estimates come from?",
    a: "When your card is identified clearly enough, GemCheck searches public eBay UK sold listing pages for that exact name, set and number — no pricing APIs and no AI guesses. We show the last verified sold comps and their average. If nothing matches, the value section is omitted.",
  },
  {
    q: "What happens to my photos?",
    a: "Grade photos are processed in memory to build your report and are not stored as image files in your account history. Check history saves report metadata (card name, estimate, date) so you can review past checks. Crop session files are temporary.",
  },
  {
    q: "What happens if a photo is rejected?",
    a: "If photo quality blocks the check, or the image is not a trading card, your report credit is not used. You can retake the photo and try again.",
  },
  {
    q: "Can photographs reveal every surface defect?",
    a: "No. Fine scratches, dents, texture changes and defects hidden by glare may not show in photos. The report notes when evidence is limited.",
  },
  {
    q: "Do unused credits expire?",
    a: "Purchased report credits do not expire. Monthly plan allowances reset each calendar month and do not roll over.",
  },
  {
    q: "Can I request a refund?",
    a: "Unused purchased report credits can be refunded through Stripe when eligible. Used credits cannot be restored.",
  },
] as const;

export type SeoPageConfig = {
  title: string;
  description: string;
  path: string;
  robots?: string;
  ogImage?: string;
  ogType?: string;
};

export const SEO = {
  home: {
    title: "GemCheck | Trading Card Pre-Grading Before You Submit",
    description: `Upload front and back card photos for clear pre-grade estimates across ${SUPPORTED_GRADERS_SHORT}. Check ${FREE_GRADES_PER_MONTH} free each month.`,
    path: "/",
  },
  howItWorks: {
    title: "How GemCheck Works | From Photos to a Grading Decision",
    description:
      "See how GemCheck turns clear front and back photos into a practical pre-grade report for Pokémon, sports and TCG cards.",
    path: "/how-it-works",
  },
  pricing: {
    title: "GemCheck Pricing | One Free Check, Pay As You Go",
    description: `1 free card check per month. Extra pre-grade reports from ${SINGLE_REPORT_PRICE}. Optional subscriptions for regular collectors.`,
    path: "/pricing",
  },
  trade: {
    title: "GemCheck for Trade | Bulk Card Pre-Grading",
    description:
      "GemCheck for card shops, breakers, dealers and bulk submitters. Triage more cards and make better grading decisions.",
    path: "/trade",
  },
  faq: {
    title: "GemCheck FAQ | Estimates, Photos, Pricing and Privacy",
    description:
      "Straight answers on pre-grade estimates, photo tips, supported graders, pricing, credits and privacy.",
    path: "/faq",
  },
  about: {
    title: "About GemCheck | Independent Pre-Grade Guidance",
    description:
      "Why GemCheck was built, what a pre-grade estimate can do, and what it cannot replace.",
    path: "/about",
  },
  contact: {
    title: "Contact GemCheck | Support and Trade Enquiries",
    description: "Contact GemCheck for account help, card checks, trade pricing or general questions.",
    path: "/contact",
  },
  requestAccess: {
    title: "Request GemCheck Beta Access",
    description: "Request an invitation to join GemCheck during invite-only beta.",
    path: "/request-access",
  },
  sampleReport: {
    title: "Sample GemCheck Report | Pre-Grade Estimate Example",
    description:
      "See a full example pre-grade report with grader estimates, condition breakdown, centring and preparation notes.",
    path: "/sample-report",
  },
  docs: {
    title: "GemCheck API | Documentation",
    description:
      "Crop trading cards and run AI pre-grades via the GemCheck API. Requires the Enterprise plan.",
    path: "/docs",
  },
  privacy: {
    title: "GemCheck Privacy Policy | How We Handle Your Data",
    description:
      "How GemCheck collects, uses and protects account data, card photos, reports and billing information.",
    path: "/privacy",
  },
  terms: {
    title: "GemCheck Terms of Service | Account and Use",
    description:
      "Terms for using GemCheck pre-grade estimates, accounts, subscriptions and the API.",
    path: "/terms",
  },
  refund: {
    title: "GemCheck Refund Policy | Credits and Subscriptions",
    description:
      "When unused report credits and subscriptions can be refunded, and how to request a refund.",
    path: "/refund",
  },
  private: {
    title: "GemCheck",
    description: "GemCheck trading card pre-grading app.",
    path: "/crop",
    robots: "noindex, nofollow",
  },
} as const satisfies Record<string, SeoPageConfig>;
