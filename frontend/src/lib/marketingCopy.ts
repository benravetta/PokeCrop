/** Shared marketing copy — en-GB, collector-native, estimate-first. */

export const ESTIMATE_DISCLAIMER =
  "GemCheck provides a pre-grade estimate only. Final grades are set by the grading company.";

export const ESTIMATE_DISCLAIMER_SHORT = "Estimate only — official grade may differ.";

export const TRUST_STRIP = [
  "Estimate only",
  "Built for collectors",
  "Front + back analysis",
  "Clear reasons, not mystery scores",
] as const;

export const WHAT_WE_CHECK = [
  { label: "Centring", copy: "Border balance front and back." },
  { label: "Corners", copy: "Whitening, dings and wear." },
  { label: "Edges", copy: "Chipping and border wear." },
  { label: "Surface", copy: "Scratches, print lines and scuffs." },
] as const;

export const SITE_FAQ = [
  {
    q: "Is GemCheck an official grade?",
    a: "No. GemCheck gives you a pre-grade estimate and practical guidance. Only PSA, Beckett, CGC and other grading companies issue official grades after inspecting the physical card.",
  },
  {
    q: "Which card types can I check?",
    a: "GemCheck is built for Pokémon, sports and other TCG cards. Upload clear front and back photos of a single card. If the image is not a trading card, the check will stop rather than guess.",
  },
  {
    q: "Do I need front and back photos?",
    a: "Yes, for the strongest estimate. The back often reveals edge wear, corner issues or print problems that change the likely grade.",
  },
  {
    q: "How accurate is the estimate?",
    a: "It depends on photo quality and what the camera can see. GemCheck highlights confidence and the biggest risk factors so you can decide whether submitting is worth the fees and wait.",
  },
  {
    q: "Which graders does GemCheck compare?",
    a: "Reports compare likely outcomes across PSA, Beckett, CGC and more. Each company weights centring, corners, edges and surface differently — that is why one card can look stronger with one grader than another.",
  },
  {
    q: "Can I use GemCheck before buying raw cards?",
    a: "Yes. Many collectors use a pre-grade check to sanity-test a purchase price or decide whether a raw card is worth grading at all.",
  },
  {
    q: "Is this useful for bulk submissions?",
    a: "Yes. Regular submitters use GemCheck to triage stacks faster. Trade users with higher volume can request trade pricing on the Trade page.",
  },
  {
    q: "Do you store my images?",
    a: "Images are processed to generate your estimate and may be kept with your account history so you can review past checks. See our privacy policy for retention details.",
  },
  {
    q: "Do you offer trade pricing?",
    a: "Yes. Card shops, breakers, dealers and submission services can request trade pricing for bulk or repeat workflows.",
  },
] as const;

export const SEO = {
  home: {
    title: "GemCheck AI | Pre-Grade TCG Cards Before You Submit",
    description:
      "Upload card photos and get a clear pre-grade estimate before you pay to submit. Built for Pokémon, sports and TCG collectors.",
  },
  howItWorks: {
    title: "How GemCheck Works | Pre-Grade Cards with Confidence",
    description:
      "See how GemCheck turns clear front and back photos into a practical pre-grade estimate for Pokémon, sports and TCG cards.",
  },
  pricing: {
    title: "GemCheck Pricing | Card Pre-Grade Checks for Collectors",
    description:
      "See GemCheck pricing for one-off checks, credit packs and regular submission workflows. Clear options for collectors and trade users.",
  },
  trade: {
    title: "GemCheck for Trade | Bulk Card Pre-Grading Workflows",
    description:
      "GemCheck for card shops, breakers, dealers and bulk submitters. Triage more cards faster and make better grading decisions.",
  },
  faq: {
    title: "GemCheck FAQ | Estimates, Photos, Pricing and Trade",
    description:
      "Read GemCheck FAQs on card-photo tips, estimate accuracy, grading-company comparisons, pricing, privacy and trade use.",
  },
  about: {
    title: "About GemCheck | Card Pre-Grade Guidance for Collectors",
    description:
      "Learn why GemCheck was built, how it helps collectors make smarter grading decisions, and what a pre-grade estimate can and cannot do.",
  },
  contact: {
    title: "Contact GemCheck | Support and Trade Enquiries",
    description:
      "Contact GemCheck for help with your account, card checks, pricing, trade use or general product questions.",
  },
} as const;
