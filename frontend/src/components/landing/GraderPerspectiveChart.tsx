import { Sparkles } from "lucide-react";
import { EXAMPLE_COMPANIES, GRADER_COMPARE_DEMO } from "./data";
import { ESTIMATE_DISCLAIMER_SHORT } from "../../lib/marketingCopy";

const SCALE = 10;

function toPct(grade: string): number {
  return (parseFloat(grade) / SCALE) * 100;
}

function bestFitName() {
  let best = EXAMPLE_COMPANIES[0].name;
  let bestVal = -1;
  for (const c of EXAMPLE_COMPANIES) {
    const val = parseFloat(c.likely);
    if (val > bestVal) {
      bestVal = val;
      best = c.name;
    }
  }
  return best;
}

function subgradeTone(value: string): string {
  const n = parseFloat(value);
  if (n >= 9) return "bg-success/25 text-success border-success/30";
  if (n >= 8) return "bg-accent/15 text-accent border-accent/25";
  if (n >= 7) return "bg-amber-500/15 text-amber-200 border-amber-500/25";
  return "bg-surface-overlay text-text-muted border-border-subtle";
}

/** Range-spectrum + subgrade matrix — distinct from the hero report list. */
export function GraderPerspectiveChart() {
  const bestFit = bestFitName();

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
            Moderate confidence
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
              const isBest = c.name === bestFit;
              const lowPct = toPct(c.low);
              const highPct = toPct(c.high);
              const likelyPct = toPct(c.likely);
              return (
                <li key={c.name}>
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`text-sm font-semibold ${isBest ? "text-success" : "text-text-primary"}`}
                      >
                        {c.name}
                      </span>
                      {isBest && (
                        <span className="rounded bg-success/15 px-1.5 py-0.5 text-[9px] font-semibold text-success">
                          Best fit
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-2 shrink-0 tabular-nums">
                      <span className={`text-lg font-bold ${isBest ? "text-success" : "text-text-primary"}`}>
                        {c.likely}
                      </span>
                      <span className="text-[10px] text-text-muted">
                        {c.low} to {c.high}
                      </span>
                    </div>
                  </div>
                  <div className="relative h-2.5 rounded-full bg-surface-overlay border border-border-subtle/80">
                    <div
                      className={`absolute inset-y-0 rounded-full ${isBest ? "bg-success/25" : "bg-accent/15"}`}
                      style={{ left: `${lowPct}%`, width: `${highPct - lowPct}%` }}
                    />
                    <div
                      className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-surface-raised shadow-sm ${
                        isBest ? "bg-success" : "bg-accent"
                      }`}
                      style={{ left: `calc(${likelyPct}% - 6px)` }}
                      aria-hidden
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="rounded-xl border border-border-subtle bg-surface-overlay/40 p-3 sm:p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-3">
            Subgrades by grader
          </p>
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full min-w-[280px] text-center border-separate border-spacing-1">
              <thead>
                <tr>
                  <th className="text-left text-[10px] font-medium text-text-muted pb-1 w-20" />
                  {EXAMPLE_COMPANIES.map((c) => (
                    <th
                      key={c.name}
                      className={`text-[10px] font-semibold pb-1 ${c.name === bestFit ? "text-success" : "text-text-secondary"}`}
                    >
                      {c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {GRADER_COMPARE_DEMO.subgradeLabels.map((label, rowIdx) => (
                  <tr key={label}>
                    <td className="text-left text-[10px] font-medium text-text-muted pr-2 py-0.5">
                      {label}
                    </td>
                    {EXAMPLE_COMPANIES.map((c) => {
                      const val = c.subs[rowIdx];
                      return (
                        <td key={c.name}>
                          <span
                            className={`inline-flex min-w-[2rem] justify-center rounded-md border px-1 py-0.5 text-[10px] font-semibold tabular-nums ${subgradeTone(val)}`}
                          >
                            {val}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[10px] text-text-muted leading-relaxed">
            Corners, centering, edges and surface are weighted differently, so the same card can
            score higher with one grader than another.
          </p>
        </div>

        <p className="text-xs text-text-secondary leading-relaxed border-t border-border-subtle pt-3">
          <span className="font-medium text-text-primary">{bestFit} leads on this example.</span>{" "}
          {ESTIMATE_DISCLAIMER_SHORT}
        </p>
      </div>
    </div>
  );
}
