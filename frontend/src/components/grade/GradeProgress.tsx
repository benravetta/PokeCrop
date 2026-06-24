import { useEffect, useRef, useState } from "react";
import { Check, Loader2, ShieldCheck } from "lucide-react";

// The real work the grader does, split into two GPT passes (vision inspection +
// adjudication) plus pricing. The durations only pace the indicator — the result
// usually lands mid-sequence, at which point the component unmounts and the
// report renders. They keep the messaging honest and moving in the meantime.
const STAGES: { label: string; ms: number }[] = [
  { label: "Preparing your photos", ms: 1500 },
  { label: "Reading the card & checking image quality", ms: 3000 },
  { label: "Measuring centering, front and back", ms: 3000 },
  { label: "Inspecting corners and edges", ms: 4500 },
  { label: "Scanning the surface for scratches & print lines", ms: 5500 },
  { label: "Cross-checking against grading standards", ms: 5500 },
  { label: "Calculating subgrades & per-company grades", ms: 4500 },
  { label: "Estimating value and compiling your report", ms: 2500 },
];
const TOTAL_MS = STAGES.reduce((a, s) => a + s.ms, 0);

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

  let acc = 0;
  let currentIndex = STAGES.length - 1;
  for (let i = 0; i < STAGES.length; i++) {
    acc += STAGES[i].ms;
    if (elapsed < acc) {
      currentIndex = i;
      break;
    }
  }

  // Ease to ~92% across the schedule, then creep so it never sits at 100% before
  // the real result lands.
  const baseFrac = Math.min(elapsed / TOTAL_MS, 1);
  const overrun = Math.max(0, elapsed - TOTAL_MS);
  const pct = baseFrac < 1 ? baseFrac * 92 : 92 + Math.min(overrun / 12000, 1) * 7;

  const remainingMs = Math.max(0, TOTAL_MS - elapsed);
  const countdown =
    remainingMs > 0 ? `about ${Math.ceil(remainingMs / 1000)}s left` : "Almost ready…";

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-raised p-8 sm:p-10 flex flex-col items-center text-center animate-[fade-in_0.25s_ease-out]">
      <div className="relative mb-6">
        <div className="w-16 h-16 rounded-2xl bg-accent/15 flex items-center justify-center">
          <ShieldCheck className="w-8 h-8 text-accent" />
        </div>
        <span className="absolute -inset-1 rounded-2xl border-2 border-accent/30 animate-ping" />
      </div>

      <h2 className="text-lg font-semibold text-text-primary">Checking your card</h2>
      <p className="mt-1 text-sm text-text-secondary max-w-sm">
        Checking centring, corners, edges and surface — this usually takes around half a minute.
      </p>

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
            <span>{countdown}</span>
          </div>
        </div>

        <ul className="flex flex-col gap-2 text-left">
          {STAGES.map((s, i) => {
            const done = i < currentIndex;
            const active = i === currentIndex;
            return (
              <li
                key={s.label}
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
                <span>{s.label}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
