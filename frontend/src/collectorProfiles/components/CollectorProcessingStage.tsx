import { useEffect, useRef, useState } from "react";
import { Check, Layers, Loader2, Upload } from "lucide-react";

type Phase = "uploading" | "processing" | "confirming" | "identifying";

const UPLOAD_STAGES: { label: string; ms: number }[] = [
  { label: "Saving to your collection", ms: 600 },
  { label: "Scanning the photo", ms: 700 },
  { label: "Finding the card edges", ms: 900 },
  { label: "Straightening for your showcase", ms: 700 },
  { label: "Cleaning up the background", ms: 800 },
  { label: "Preparing your card preview", ms: 500 },
];

const CONFIRM_STAGES: { label: string; ms: number }[] = [
  { label: "Applying GemCheck crop", ms: 800 },
  { label: "Building showcase images", ms: 900 },
  { label: "Almost ready", ms: 400 },
];

const IDENTIFY_STAGES: { label: string; ms: number }[] = [
  { label: "Reading the card name", ms: 700 },
  { label: "Matching set and number", ms: 900 },
  { label: "Filling in card details", ms: 800 },
];

function stagesForPhase(phase: Phase) {
  if (phase === "confirming") return CONFIRM_STAGES;
  if (phase === "identifying") return IDENTIFY_STAGES;
  return UPLOAD_STAGES;
}

export function CollectorProcessingStage({
  phase = "processing",
  label,
}: {
  phase?: Phase;
  label?: string;
}) {
  const [elapsed, setElapsed] = useState(0);
  const start = useRef(performance.now());
  const stages = stagesForPhase(phase);
  const totalMs = stages.reduce((a, s) => a + s.ms, 0);

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
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-5 rounded-2xl bg-surface-overlay px-6 py-8 anim-fade">
        <div
          className="skeleton rounded-xl border border-border-subtle"
          style={{ width: "min(34vh, 190px)", aspectRatio: "63 / 88" }}
        />
        <div className="flex items-center gap-2 text-text-secondary">
          <Upload className="h-4 w-4 animate-pulse text-accent" />
          <p className="text-sm">{label ?? "Uploading to your collection…"}</p>
        </div>
      </div>
    );
  }

  let acc = 0;
  let currentIndex = stages.length - 1;
  for (let i = 0; i < stages.length; i++) {
    acc += stages[i].ms;
    if (elapsed < acc) {
      currentIndex = i;
      break;
    }
  }

  const base = Math.min(elapsed / totalMs, 1);
  const overrun = Math.max(0, elapsed - totalMs);
  const pct = base < 1 ? base * 92 : 92 + Math.min(overrun / 8000, 1) * 7;
  const remainingMs = Math.max(0, totalMs - elapsed);
  const countdown =
    remainingMs > 0 ? `about ${Math.ceil(remainingMs / 1000)}s left` : "Almost ready…";

  const headline =
    label ??
    (phase === "confirming"
      ? "Adding to your collection"
      : phase === "identifying"
        ? "Reading your card"
        : "Preparing your card");

  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-5 rounded-2xl bg-surface-overlay px-6 py-8 anim-fade">
      <div
        className="skeleton rounded-xl border border-border-subtle"
        style={{ width: "min(26vh, 150px)", aspectRatio: "63 / 88" }}
      />

      <div className="flex w-full max-w-xs flex-col gap-3">
        <div className="flex items-center justify-center gap-2 text-text-secondary">
          <Layers className="h-4 w-4 text-accent" />
          <p className="text-sm font-medium text-text-primary">{headline}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border-subtle">
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

        <ul className="flex flex-col gap-1.5">
          {stages.map((s, i) => {
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
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  {done ? (
                    <Check className="h-3.5 w-3.5 text-accent" />
                  ) : active ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-text-muted/40" />
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
