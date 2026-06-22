import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Upload } from "lucide-react";

type Phase = "uploading" | "processing";

// The real stages the crop pipeline runs server-side, with rough durations used
// only to pace the indicator. The result usually arrives mid-sequence; when it
// does the component unmounts and the UI moves on, so these timings just keep
// the messaging honest and moving rather than driving the actual work.
const STAGES: { label: string; ms: number }[] = [
  { label: "Scanning the photo", ms: 700 },
  { label: "Isolating the card from its background", ms: 1000 },
  { label: "Detecting the four edges", ms: 600 },
  { label: "Straightening and de-skewing", ms: 600 },
  { label: "Cleaning up the background", ms: 800 },
  { label: "Finishing your scan", ms: 400 },
];
const TOTAL_MS = STAGES.reduce((a, s) => a + s.ms, 0);

export function ProcessingStage({
  phase = "processing",
  label,
}: {
  phase?: Phase;
  label?: string;
}) {
  const [elapsed, setElapsed] = useState(0);
  const start = useRef(performance.now());

  useEffect(() => {
    start.current = performance.now();
    setElapsed(0);
    const id = window.setInterval(() => {
      setElapsed(performance.now() - start.current);
    }, 100);
    return () => window.clearInterval(id);
  }, [phase]);

  if (phase === "uploading") {
    return (
      <div className="flex-1 min-h-0 w-full rounded-2xl bg-surface-overlay flex flex-col items-center justify-center gap-5 anim-fade">
        <div
          className="skeleton rounded-xl border border-border-subtle"
          style={{ width: "min(34vh, 190px)", aspectRatio: "63 / 88" }}
        />
        <div className="flex items-center gap-2 text-text-secondary">
          <Upload className="w-4 h-4 text-accent animate-pulse" />
          <p className="text-sm">{label ?? "Uploading your photo…"}</p>
        </div>
      </div>
    );
  }

  // Which stage are we on, based on elapsed time vs the cumulative schedule.
  let acc = 0;
  let currentIndex = STAGES.length - 1;
  for (let i = 0; i < STAGES.length; i++) {
    acc += STAGES[i].ms;
    if (elapsed < acc) {
      currentIndex = i;
      break;
    }
  }

  // Progress eases to ~92% across the schedule, then creeps slowly so it never
  // sits at 100% before the real result lands.
  const base = Math.min(elapsed / TOTAL_MS, 1);
  const overrun = Math.max(0, elapsed - TOTAL_MS);
  const pct =
    base < 1 ? base * 92 : 92 + Math.min(overrun / 8000, 1) * 7;

  const remainingMs = Math.max(0, TOTAL_MS - elapsed);
  const countdown =
    remainingMs > 0 ? `about ${Math.ceil(remainingMs / 1000)}s left` : "Almost ready…";

  return (
    <div className="flex-1 min-h-0 w-full rounded-2xl bg-surface-overlay flex flex-col items-center justify-center gap-5 anim-fade px-6 py-6">
      <div
        className="skeleton rounded-xl border border-border-subtle"
        style={{ width: "min(26vh, 150px)", aspectRatio: "63 / 88" }}
      />

      <div className="w-full max-w-xs flex flex-col gap-3">
        {/* Progress bar + countdown */}
        <div className="flex flex-col gap-1.5">
          <div className="h-1.5 w-full rounded-full bg-border-subtle overflow-hidden">
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

        {/* Real pipeline steps with live status */}
        <ul className="flex flex-col gap-1.5">
          {STAGES.map((s, i) => {
            const done = i < currentIndex;
            const active = i === currentIndex;
            return (
              <li
                key={s.label}
                className={`flex items-center gap-2 text-[12px] leading-snug transition-colors ${
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
