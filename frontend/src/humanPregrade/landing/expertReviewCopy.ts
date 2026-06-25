export const EXPERT_REVIEW = {
  kicker: "Human expert review",
  heroTitle: "A real person reviews your card — not just an algorithm.",
  heroCopy:
    "Upload clear photos and a GemCheck expert returns a bespoke pre-grading report: condition notes, likely grades across PSA, CGC, BGS and more, and practical advice before you submit.",
  ctaPrimary: "Start expert review",
  ctaSecondary: "View your reviews",
  compare: {
    kicker: "AI vs expert",
    title: "Instant AI checks and human depth — different jobs, both useful",
    ai: {
      label: "AI pre-grade",
      badge: "Seconds",
      points: [
        "Five grading companies scored in one pass",
        "Great for quick buy/sell decisions",
        "Included on paid plans or pay-per-grade",
      ],
    },
    expert: {
      label: "Expert review",
      badge: "Human",
      points: [
        "Written assessment from a trained reviewer",
        "Defect call-outs tied to your actual photos",
        "Ideal before expensive submissions",
      ],
    },
  },
  flow: {
    kicker: "How it works",
    title: "Four steps from photos to report",
    steps: [
      {
        id: "upload",
        title: "Upload your images",
        copy: "Front and back photos in good light. We’ll tell you if we need clearer shots before the review starts.",
        icon: "camera" as const,
      },
      {
        id: "pay",
        title: "Pay & submit",
        copy: "Secure checkout, then your order joins the expert queue. You can track progress in your account.",
        icon: "card" as const,
      },
      {
        id: "review",
        title: "Expert assessment",
        copy: "A human reviewer examines your images, notes condition issues, and drafts grade predictions per company.",
        icon: "expert" as const,
      },
      {
        id: "report",
        title: "Download your report",
        copy: "A PDF report with findings, predictions, and submission guidance — yours to keep and share.",
        icon: "report" as const,
      },
    ],
  },
  includes: {
    kicker: "What you get",
    title: "Everything in your expert report",
    items: [
      { title: "Condition breakdown", copy: "Corners, edges, surface and centreing called out with photo references." },
      { title: "Multi-grader predictions", copy: "Likely outcomes across the graders you select at checkout." },
      { title: "Written narrative", copy: "Plain-English summary — not just numbers on a chart." },
      { title: "Submission guidance", copy: "Whether to grade, which tier, and what to watch for." },
      { title: "Quality-checked", copy: "Every report passes an internal review before delivery." },
      { title: "PDF download", copy: "Archive-ready report you can attach to listings or insurance." },
    ],
  },
  disclaimers: [
    "Independent pre-grading opinion based on digital images — not official grading or authentication.",
    "Final grades are decided by the grading company after physical inspection.",
    "Poor or incomplete images may delay completion until replacements are provided.",
    "Turnaround is an estimate, not a guarantee.",
  ],
  home: {
    kicker: "Human expert review",
    title: "Want a second opinion from a real person?",
    copy:
      "Our AI pre-grade is instant — but before you pay PSA or CGC, a GemCheck expert can review your photos and send a written report with condition notes and grader predictions.",
    priceFallback: "£29.99",
    priceSuffix: "per card",
    ctaLoggedIn: "Explore expert review",
    ctaGuest: "Get started — then request a review",
    ctaSecondary: "See how it works",
    bullets: [
      "Written assessment from a trained reviewer",
      "Defect call-outs tied to your photos",
      "PDF report in ~48 hours",
    ],
    heroTeaser: "Need a human expert before you submit?",
  },
} as const;
