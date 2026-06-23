import { Camera, ScanSearch, Wrench, Scale } from "lucide-react";
import { SectionHeading } from "./shared";

export function HowItWorksSection() {
  const steps = [
    {
      icon: Camera,
      title: "Photograph",
      copy: "Front and back, flat and in focus. A phone photo on a desk is fine.",
    },
    {
      icon: ScanSearch,
      title: "Get your report",
      copy: "Per-company grade estimates, centring, condition scores, and what limits the grade.",
    },
    {
      icon: Wrench,
      title: "Prep if it helps",
      copy: "A checklist of light fixes worth trying — with notes on what's permanent.",
    },
    {
      icon: Scale,
      title: "Submit or sell raw",
      copy: "Send to the grader where your card scores best — or skip grading entirely.",
    },
  ];

  return (
    <section
      id="how"
      className="border-b border-border-subtle bg-surface-raised/30 py-14 sm:py-16 scroll-mt-20"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading kicker="How it works" title="Four steps. One clear answer." />
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((s, i) => (
            <div
              key={s.title}
              className="rounded-2xl border border-border-subtle bg-surface-raised p-5"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex w-9 h-9 rounded-lg bg-accent/15 items-center justify-center shrink-0">
                  <s.icon className="w-4 h-4 text-accent" />
                </span>
                <span className="text-xs font-semibold text-text-muted">Step {i + 1}</span>
              </div>
              <h3 className="mt-3 text-base font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-sm text-text-secondary leading-relaxed">{s.copy}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
