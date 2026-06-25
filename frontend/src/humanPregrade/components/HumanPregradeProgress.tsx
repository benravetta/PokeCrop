import { Check, Loader2 } from "lucide-react";
import { CUSTOMER_PROGRESS_STEPS, type CustomerProgress } from "../copy";

export function HumanPregradeProgress({
  progress,
  compact = false,
}: {
  progress: CustomerProgress;
  compact?: boolean;
}) {
  if (progress.isTerminal) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
        {progress.label}
      </div>
    );
  }

  const pct = progress.percentComplete;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 max-w-[120px] rounded-full bg-surface-overlay overflow-hidden">
          <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[11px] text-text-muted">{progress.label}</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-raised p-5 space-y-4">
      <div className="flex flex-col gap-1.5">
        <div className="h-2 w-full rounded-full bg-surface-overlay overflow-hidden">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-text-muted">
          <span>{pct}%</span>
          <span>{progress.label}</span>
        </div>
      </div>
      <ul className="flex flex-col gap-2">
        {CUSTOMER_PROGRESS_STEPS.map((step) => {
          const done = progress.step > step.id || (progress.step === step.id && step.id === 7);
          const active =
            progress.step === step.id ||
            (progress.isBranch && progress.branchStep === step.id);
          const isBranchActive = progress.isBranch && step.id === 5;
          return (
            <li
              key={step.id}
              className={`flex items-center gap-2.5 text-[13px] ${
                isBranchActive
                  ? "text-amber-300"
                  : active
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
              <span>{step.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
