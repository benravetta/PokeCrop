import { Sparkles } from "lucide-react";
import {
  EXAMPLE_COMPANIES,
  GRADER_COMPARE_DEMO,
  SUBGRADE_KEYS,
  getExampleSubgrade,
} from "./data";
import { ESTIMATE_DISCLAIMER_SHORT } from "../../lib/marketingCopy";

const SCALE = 10;

function toPct(grade: string): number {
  return (parseFloat(grade) / SCALE) * 100;
}

function isBestFit(c: (typeof EXAMPLE_COMPANIES)[number]): boolean {
  return "bestFit" in c && c.bestFit === true;
}

function subgradeTone(value: string): string {
  const n = parseFloat(value);
  if (n >= 9) return "bg-success/25 text-success border-success/30";
  if (n >= 8) return "bg-accent/15 text-accent border-accent/25";
  if (n >= 7) return "bg-amber-500/15 text-amber-200 border-amber-500/25";
  return "bg-surface-overlay text-text-muted border-border-subtle";
}

/** Lowest subgrade for a grader — explains why the likely grade sits where it does. */
function limitingSubgrade(c: (typeof EXAMPLE_COMPANIES)[number]): string | null {
  if (!c.subgrades) return null;
  let lowestKey: (typeof SUBGRADE_KEYS)[number] | null = null;
  let lowestVal = Infinity;
  for (const key of SUBGRADE_KEYS) {
    const val = parseFloat(c.subgrades[key]);
    if (val < lowestVal) {
      lowestVal = val;
      lowestKey = key;
    }
  }
  if (!lowestKey) return null;
  const label = GRADER_COMPARE_DEMO.subgradeLabels[SUBGRADE_KEYS.indexOf(lowestKey)];
  return `${label} ${c.subgrades[lowestKey]} limits the ceiling`;
}

const SUBGRADE_GRADERS = EXAMPLE_COMPANIES.filter((c) => c.subgrades != null);

/** Range-spectrum + subgrade matrix — distinct from the hero report list. */
export function GraderPerspectiveChart() {
  return (
    <div className="relative rounded-2xl border border-border-subtle bg-surface-raised overflow-hidden shadow-xl shadow-black/20">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />

      <div className="p-4 sm:p-5 border-b border-border-subtle bg-surface-overlay/30">
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-[4.5rem] shrink-0 rounded-lg border border-border-subtle bg-contain bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${GRADER_COMPARE_DEMO.thumb})`, backgroundColor: "#f3f4f6" }}
            role="img"
            aria-label={`${GRADER_COMPARE_DEMO.card} sample`}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wider text-text-muted font-medium">
              Example comparison
            </p>
            <p className="mt-0.5 text-base font-semibold text-text-primary truncate">
              {GRADER_COMPARE_DEMO.card}
            </p>
            <p className="text-xs text-text-muted mt-0.5">{GRADER_COMPARE_DEMO.set}</p>
          </div>
          <span className="hidden sm:inline-flex shrink-0 items-center gap-1 rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1 text-[10px] font-semibold text-accent">
            <Sparkles className="w-3 h-3" />
            {GRADER_COMPARE_DEMO.confidence}
          </span>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <p className="text-xs font-semibold text-text-primary">Likely grade range</p>
            <p className="text-[10px] text-text-muted">Same photos · five standards</p>
          </div>
          <ul className="space-y-3">
            {EXAMPLE_COMPANIES.map((c) => {
              const best = isBestFit(c);
              const lowPct = toPct(c.low);
              const highPct = toPct(c.high);
              const likelyPct = toPct(c.likely);
              const limit = limitingSubgrade(c);
              return (
                <li key={c.name}>
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <span
                        className={`text-sm font-semibold ${best ? "text-success" : "text-text-primary"}`}
                      >
                        {c.name}
                      </span>
                      {best && (
                        <span className="rounded bg-success/15 px-1.5 py-0.5 text-[9px] font-semibold text-success">
                          Best fit
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-2 shrink-0 tabular-nums">
                      <span className={`text-lg font-bold ${best ? "text-success" : "text-text-primary"}`}>
                        {c.likely}
                      </span>
                      <span className="text-[10px] text-text-muted">
                        {c.low} to {c.high}
                      </span>
                    </div>
                  </div>
                  <div className="relative h-2.5 rounded-full bg-surface-overlay border border-border-subtle/80">
                    <div
                      className={`absolute inset-y-0 rounded-full ${best ? "bg-success/25" : "bg-accent/15"}`}
                      style={{ left: `${lowPct}%`, width: `${highPct - lowPct}%` }}
                    />
                    <div
                      className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-surface-raised shadow-sm ${
                        best ? "bg-success" : "bg-accent"
                      }`}
                      style={{ left: `calc(${likelyPct}% - 6px)` }}
                      aria-hidden
                    />
                  </div>
                  {("note" in c && c.note) || limit ? (
                    <p className="mt-1.5 text-[10px] text-text-muted leading-snug">
                      {"note" in c && c.note ? c.note : limit}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="rounded-xl border border-border-subtle bg-surface-overlay/40 p-3 sm:p-4">
          <div className="flex items-baseline justify-between gap-2 mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Subgrades by grader
            </p>
            <p className="text-[10px] text-text-muted">PSA grades holistically</p>
          </div>
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full min-w-[240px] text-center border-separate border-spacing-1">
              <thead>
                <tr>
                  <th className="text-left text-[10px] font-medium text-text-muted pb-1 w-20" />
                  {SUBGRADE_GRADERS.map((c) => (
                    <th
                      key={c.name}
                      className={`text-[10px] font-semibold pb-1 ${isBestFit(c) ? "text-success" : "text-text-secondary"}`}
                    >
                      {c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {GRADER_COMPARE_DEMO.subgradeLabels.map((label, rowIdx) => {
                  const key = SUBGRADE_KEYS[rowIdx];
                  return (
                    <tr key={label}>
                      <td className="text-left text-[10px] font-medium text-text-muted pr-2 py-0.5">
                        {label}
                      </td>
                      {SUBGRADE_GRADERS.map((c) => {
                        const val = getExampleSubgrade(c, key)!;
                        const isLimit =
                          c.subgrades &&
                          parseFloat(val) ===
                            Math.min(...SUBGRADE_KEYS.map((k) => parseFloat(c.subgrades![k])));
                        return (
                          <td key={c.name}>
                            <span
                              className={`inline-flex min-w-[2rem] justify-center rounded-md border px-1 py-0.5 text-[10px] font-semibold tabular-nums ${subgradeTone(val)} ${
                                isLimit ? "ring-1 ring-amber-500/40" : ""
                              }`}
                              title={isLimit ? "Lowest subgrade for this grader" : undefined}
                            >
                              {val}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[10px] text-text-muted leading-relaxed">
            Each grader weights corners, centring, edges and surface differently. The lowest
            subgrade often sets the ceiling on Beckett, CGC, TAG and ACE.
          </p>
        </div>

        <p className="text-xs text-text-secondary leading-relaxed border-t border-border-subtle pt-3">
          <span className="font-medium text-text-primary">
            Likely best fit: {GRADER_COMPARE_DEMO.bestFit}.
          </span>{" "}
          {GRADER_COMPARE_DEMO.bestFitReason} {ESTIMATE_DISCLAIMER_SHORT}
        </p>
      </div>
    </div>
  );
}
