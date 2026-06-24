import { ArrowRight, CheckCircle2, Gauge, Layers, Scale, Target } from "lucide-react";
import { EXAMPLE_COMPANIES } from "./data";
import { ESTIMATE_DISCLAIMER_SHORT, GRADER_COMPARE } from "../../lib/marketingCopy";
import { AppWindow, SectionHeading } from "./shared";

const FEATURE_ICONS = [Scale, Layers, Gauge, Target] as const;

/** Pick the grader with the highest numeric likely estimate for the demo highlight. */
function bestFitIndex() {
  let best = 0;
  let bestVal = -1;
  EXAMPLE_COMPANIES.forEach((c, i) => {
    const val = parseFloat(c.likely);
    if (val > bestVal) {
      bestVal = val;
      best = i;
    }
  });
  return best;
}

function GraderComparePanel() {
  const bestIdx = bestFitIndex();
  const best = EXAMPLE_COMPANIES[bestIdx];

  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-accent/10 blur-3xl opacity-60"
      />
      <AppWindow title="Grader comparison" className="relative">
        <div className="p-4 sm:p-5 bg-surface-raised">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-text-muted font-medium">
                Sample card
              </p>
              <p className="mt-0.5 text-sm font-semibold text-text-primary">Erika&apos;s Oddish</p>
              <p className="text-[11px] text-text-muted mt-0.5">Gym Heroes · 1st Edition</p>
            </div>
            <span className="shrink-0 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[10px] font-semibold text-accent">
              Moderate confidence
            </span>
          </div>

          <div className="mt-4 rounded-xl border border-border-subtle overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-3 py-2 bg-surface-overlay/50 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              <span>Grader</span>
              <span className="text-right w-14">Likely</span>
              <span className="text-right w-16 hidden sm:block">Range</span>
            </div>
            <ul className="divide-y divide-border-subtle">
              {EXAMPLE_COMPANIES.map((c, i) => {
                const isBest = i === bestIdx;
                const pct = (parseFloat(c.likely) / 10) * 100;
                return (
                  <li
                    key={c.name}
                    className={`px-3 py-2.5 ${isBest ? "bg-success/8" : ""}`}
                  >
                    <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-semibold ${isBest ? "text-success" : "text-text-primary"}`}
                          >
                            {c.name}
                          </span>
                          {isBest && (
                            <span className="rounded-full bg-success/15 border border-success/30 px-1.5 py-0.5 text-[9px] font-semibold text-success">
                              Likely best fit
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 h-1.5 rounded-full bg-surface-overlay overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isBest ? "bg-success" : "bg-accent/70"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <span
                        className={`text-lg font-bold tabular-nums w-14 text-right ${isBest ? "text-success" : "text-text-primary"}`}
                      >
                        {c.likely}
                      </span>
                      <span className="text-xs tabular-nums text-text-muted w-16 text-right hidden sm:block">
                        {c.low} to {c.high}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-lg border border-border-subtle bg-surface-overlay/40 px-3 py-2.5">
            <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
            <p className="text-xs text-text-secondary leading-relaxed">
              <span className="font-medium text-text-primary">{best.name} looks strongest here.</span>{" "}
              {ESTIMATE_DISCLAIMER_SHORT}
            </p>
          </div>
        </div>
      </AppWindow>
    </div>
  );
}

export function GraderCompareSection() {
  return (
    <section className="relative py-16 sm:py-20 border-b border-border-subtle overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-accent/[0.04] via-transparent to-transparent"
      />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          kicker={GRADER_COMPARE.kicker}
          title={GRADER_COMPARE.heading}
          copy={GRADER_COMPARE.body}
        />

        <div className="mt-12 lg:mt-14 grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          <GraderComparePanel />

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

            <a
              href="#report"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20 w-full sm:w-auto mt-2"
            >
              {GRADER_COMPARE.cta}
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
