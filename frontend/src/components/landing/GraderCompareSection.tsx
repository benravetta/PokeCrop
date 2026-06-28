import { Link } from "react-router-dom";
import { ArrowRight, Gauge, Layers, Scale, Target } from "lucide-react";
import { GRADER_COMPARE } from "../../lib/marketingCopy";
import { GraderPerspectiveChart } from "./GraderPerspectiveChart";
import { SectionHeading } from "./shared";

const FEATURE_ICONS = [Scale, Layers, Gauge, Target] as const;

export function GraderCompareSection() {
  return (
    <section className="relative py-16 sm:py-20 border-b border-border-subtle overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-accent/[0.04] via-transparent to-transparent"
      />
      <div className="relative mx-auto w-full max-w-6xl page-x">
        <SectionHeading
          kicker={GRADER_COMPARE.kicker}
          title={GRADER_COMPARE.heading}
          copy={GRADER_COMPARE.body}
        />

        <div className="mt-12 lg:mt-14 grid lg:grid-cols-2 gap-10 lg:gap-14 items-start">
          <div className="relative lg:sticky lg:top-24">
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-4 rounded-[2rem] bg-accent/8 blur-3xl opacity-50"
            />
            <GraderPerspectiveChart />
          </div>

          <div className="space-y-4">
            {GRADER_COMPARE.points.map((point, i) => {
              const Icon = FEATURE_ICONS[i] ?? Scale;
              return (
                <div
                  key={point.title}
                  className="group flex gap-4 rounded-2xl border border-border-subtle bg-surface-raised/80 p-4 sm:p-5 transition-colors hover:border-accent/25 hover:bg-surface-raised"
                >
                  <span className="inline-flex w-11 h-11 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent group-hover:bg-accent/20 transition-colors">
                    <Icon className="w-5 h-5" />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <h3 className="text-sm font-semibold text-text-primary">{point.title}</h3>
                    <p className="mt-1 text-sm text-text-secondary leading-relaxed">{point.copy}</p>
                  </div>
                </div>
              );
            })}

            <Link
              to="/sample-report"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20 w-full sm:w-auto mt-2"
            >
              {GRADER_COMPARE.cta}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
