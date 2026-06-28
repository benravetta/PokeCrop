import { Camera, Scale, ScanSearch, Sparkles } from "lucide-react";
import { HOW_IT_WORKS } from "../../lib/marketingCopy";
import { SectionHeading } from "./shared";

const STEP_ICONS = [Camera, ScanSearch, Sparkles, Scale] as const;

export function HowItWorksSection() {
  return (
    <section
      id="how"
      className="border-b border-border-subtle bg-surface-raised/30 py-14 sm:py-16 scroll-mt-20"
    >
      <div className="mx-auto w-full max-w-6xl page-x">
        <SectionHeading
          kicker={HOW_IT_WORKS.kicker}
          title={HOW_IT_WORKS.heading}
          copy={HOW_IT_WORKS.intro}
        />
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {HOW_IT_WORKS.steps.map((s, i) => {
            const Icon = STEP_ICONS[i] ?? Camera;
            return (
              <div
                key={s.title}
                className="rounded-2xl border border-border-subtle bg-surface-raised p-5"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex w-9 h-9 rounded-lg bg-accent/15 items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-accent" />
                  </span>
                  <span className="text-xs font-semibold text-text-muted">Step {i + 1}</span>
                </div>
                <h3 className="mt-3 text-base font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm text-text-secondary leading-relaxed">{s.copy}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
