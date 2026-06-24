import { useEffect, useRef, useState } from "react";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { GRADE_PROGRESS, PROCESSING_STAGES } from "../../lib/gradeUploadCopy";

const STAGE_MS = 6000;
const TOTAL_MS = PROCESSING_STAGES.length * STAGE_MS;

export function GradeProgress() {
  const [elapsed, setElapsed] = useState(0);
  const start = useRef(performance.now());

  useEffect(() => {
    start.current = performance.now();
    setElapsed(0);
    const id = window.setInterval(() => {
      setElapsed(performance.now() - start.current);
    }, 100);
    return () => window.clearInterval(id);
  }, []);

  const currentIndex = Math.min(
    PROCESSING_STAGES.length - 1,
    Math.floor(elapsed / STAGE_MS)
  );

  const baseFrac = Math.min(elapsed / TOTAL_MS, 1);
  const overrun = Math.max(0, elapsed - TOTAL_MS);
  const pct = baseFrac < 1 ? baseFrac * 92 : 92 + Math.min(overrun / 12000, 1) * 7;

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-raised p-8 sm:p-10 flex flex-col items-center text-center animate-[fade-in_0.25s_ease-out]">
      <div className="relative mb-6">
        <div className="w-16 h-16 rounded-2xl bg-accent/15 flex items-center justify-center">
          <ShieldCheck className="w-8 h-8 text-accent" />
        </div>
        <span className="absolute -inset-1 rounded-2xl border-2 border-accent/30 animate-ping" />
      </div>

      <h2 className="text-lg font-semibold text-text-primary">{GRADE_PROGRESS.heading}</h2>
      <p className="mt-1 text-sm text-text-secondary max-w-sm">{GRADE_PROGRESS.sub}</p>

      <div className="mt-7 w-full max-w-md flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="h-2 w-full rounded-full bg-surface-overlay overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-200 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-text-muted">
            <span>{Math.round(pct)}%</span>
            <span>{elapsed < TOTAL_MS ? "Working…" : "Almost ready…"}</span>
          </div>
        </div>

        <ul className="flex flex-col gap-2 text-left">
          {PROCESSING_STAGES.map((label, i) => {
            const done = i < currentIndex;
            const active = i === currentIndex;
            return (
              <li
                key={label}
                className={`flex items-center gap-2.5 text-[13px] leading-snug transition-colors ${
                  active
                    ? "text-text-primary"
                    : done
                      ? "text-text-secondary"
                      : "text-text-muted/60"
                }`}
              >
                <span className="w-4 h-4 flex items-center justify-center shrink-0">
                  {done ? (
                    <Check className="w-3.5 h-3.5 text-accent" />
                  ) : active ? (
                    <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-text-muted/40" />
                  )}
                </span>
                <span>{label}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
