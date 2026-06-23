import { Camera, Scale, ScanSearch, Wrench } from "lucide-react";
import { SectionHeading } from "./shared";

export function CompareSection() {
  const graders = [
    { name: "PSA", grade: "8", note: "Whole grades, no subgrades" },
    { name: "Beckett", grade: "8.5", note: "Half grades + subgrades" },
    { name: "CGC", grade: "8.5", note: "Half grades + subgrades" },
    { name: "ACE", grade: "8.0", note: "One-decimal grades" },
    { name: "TAG", grade: "8.2", note: "Algorithmic, 1-1000 scale" },
  ];

  return (
    <section id="compare" className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24 scroll-mt-20">
      <SectionHeading
        kicker="Compare grading companies"
        title="One card. Five grading standards."
        copy="Each company weights centring, corners, edges and surface differently. GemCheck estimates them all so you can send your card where it scores best."
      />
      <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {graders.map((g) => (
          <div
            key={g.name}
            className="group relative rounded-2xl border border-border-subtle bg-surface-raised p-5 overflow-hidden hover:border-accent/40 transition-colors"
          >
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-1 opacity-70"
              style={{
                background:
                  "linear-gradient(90deg, var(--color-accent), #38bdf8, var(--color-accent))",
              }}
            />
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold">{g.name}</span>
              <Scale className="w-4 h-4 text-text-muted" />
            </div>
            <div className="mt-4">
              <div className="text-[11px] uppercase tracking-wide text-text-muted">Estimated</div>
              <div className="text-3xl font-semibold text-text-primary">{g.grade}</div>
            </div>
            <div className="mt-3 text-xs text-text-secondary">{g.note}</div>
          </div>
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-text-muted">
        Example estimates. GemCheck is independent and not affiliated with any grading company.
      </p>
    </section>
  );
}

export function HowItWorksSection() {
  const steps = [
    {
      icon: Camera,
      title: "Photograph",
      copy: "Snap the front and back, flat and in sharp focus. A phone photo on a desk works fine.",
    },
    {
      icon: ScanSearch,
      title: "Inspect",
      copy: "We measure centring, check corners, edges and surface — the same things graders look at.",
    },
    {
      icon: Wrench,
      title: "Prepare",
      copy: "See what's fixable and clean it up to lift the grade before you post it off.",
    },
    {
      icon: Scale,
      title: "Decide",
      copy: "Submit to the best-fit grader — or sell it raw with confidence.",
    },
  ];

  return (
    <section
      id="how"
      className="border-y border-border-subtle bg-surface-raised/30 py-16 sm:py-24 scroll-mt-20"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading kicker="How it works" title="From photo to confident decision." />
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((s, i) => (
            <div
              key={s.title}
              className="relative rounded-2xl border border-border-subtle bg-surface-raised p-5"
            >
              <span className="text-5xl font-bold text-surface-overlay absolute top-3 right-4 select-none">
                {i + 1}
              </span>
              <span className="inline-flex w-10 h-10 rounded-xl bg-accent/15 items-center justify-center">
                <s.icon className="w-5 h-5 text-accent" />
              </span>
              <h3 className="mt-4 text-base font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-sm text-text-secondary leading-relaxed">{s.copy}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
