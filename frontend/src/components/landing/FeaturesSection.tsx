import { Link } from "react-router-dom";
import { ArrowRight, Check, Crop, ScanSearch } from "lucide-react";
import { SINGLE_GRADE } from "./data";
import { SectionHeading } from "./shared";

const FEATURES = [
  {
    icon: ScanSearch,
    tag: "Grade",
    title: "Pre-grade before you submit",
    copy: "Photograph front and back. Get estimates for PSA, Beckett, CGC, ACE and TAG, measured centring, condition scores, and a prep checklist — as a PDF you can keep.",
    bullets: [
      "Company-by-company estimates",
      "Preparation plan with flaw notes",
      `Single reports from ${SINGLE_GRADE.price} — no subscription`,
    ],
    to: "/grade",
    cta: "Check a card",
  },
  {
    icon: Crop,
    tag: "Crop & centring",
    title: "Straighten, crop and measure centring",
    copy: "Drop a desk photo, binder snap or PDF. GemCheck straightens the card, exports a transparent PNG, and measures border centring on the same canvas — no Photoshop required.",
    bullets: ["Auto-detect & de-skew", "Border centring measurement", "Original & web-size exports"],
    to: "/crop",
    cta: "Try crop tool",
  },
] as const;

export function FeaturesSection() {
  return (
    <section id="features" className="scroll-mt-20 py-16 sm:py-20 border-b border-border-subtle">
      <div className="mx-auto w-full max-w-6xl page-x">
        <SectionHeading
          kicker="What you get"
          title="Two tools. One decision."
          copy="Check whether a card is worth grading, and prep the photos properly — straighten, measure centring, export — without jumping between apps."
        />

        <div className="mt-12 grid md:grid-cols-2 gap-6">
          {FEATURES.map((f) => (
            <article
              key={f.tag}
              className="rounded-2xl border border-border-subtle bg-surface-raised p-6 sm:p-8"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex w-10 h-10 rounded-xl bg-accent/15 items-center justify-center">
                  <f.icon className="w-5 h-5 text-accent" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  {f.tag}
                </span>
              </div>
              <h3 className="mt-4 text-xl font-semibold tracking-tight">{f.title}</h3>
              <p className="mt-2 text-sm text-text-secondary leading-relaxed">{f.copy}</p>
              <ul className="mt-4 space-y-2">
                {f.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm text-text-primary">
                    <Check className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
              <Link
                to={f.to}
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:text-accent-hover transition-colors"
              >
                {f.cta}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function WhySection() {
  const points = [
    {
      title: "Grading isn't cheap",
      copy: "£15–£150 per card, weeks of waiting, and no refund if the grade disappoints.",
    },
    {
      title: "Every company scores differently",
      copy: "PSA, Beckett and CGC weight centring, corners and surface differently. One card can be an 8 with one and a 9 with another.",
    },
    {
      title: "Small fixes can matter",
      copy: "Loose debris and light edge dust are sometimes worth addressing before submission — if you know where to look.",
    },
  ];

  return (
    <section className="py-14 sm:py-16 bg-surface-raised/30">
      <div className="mx-auto w-full max-w-6xl page-x">
        <p className="text-center text-base text-text-secondary max-w-2xl mx-auto">
          Most collectors submit blind.{" "}
          <span className="text-text-primary font-medium">GemCheck is the check before the cheque.</span>
        </p>
        <div className="mt-10 grid sm:grid-cols-3 gap-4">
          {points.map((p) => (
            <div key={p.title} className="rounded-xl border border-border-subtle bg-surface-raised p-5">
              <h3 className="text-sm font-semibold text-text-primary">{p.title}</h3>
              <p className="mt-1.5 text-sm text-text-secondary leading-relaxed">{p.copy}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
