import { useNavigate } from "react-router-dom";
import { Sparkles, X } from "lucide-react";
import { useAppStore } from "../hooks/useProcessing";

export function UpgradeModal() {
  const { limitReached, clearLimit, reset } = useAppStore();
  const navigate = useNavigate();

  if (!limitReached) return null;

  const goToPlans = () => {
    clearLimit();
    navigate("/pricing");
  };

  const dismiss = () => {
    clearLimit();
    // The blocked upload produced no result; clear it so the upload screen returns.
    reset();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-black/60 anim-fade">
      <div className="w-full max-w-sm rounded-2xl border border-border-subtle bg-surface-raised p-6 shadow-2xl anim-scale">
        <div className="flex items-start justify-between">
          <span className="w-11 h-11 rounded-xl bg-accent/15 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-accent" />
          </span>
          <button
            onClick={dismiss}
            className="p-1.5 -mr-1.5 -mt-1.5 rounded-lg text-text-muted hover:bg-surface-overlay hover:text-text-primary transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <h2 className="mt-4 text-base font-semibold text-text-primary">
          You're out of free crops today
        </h2>
        <p className="mt-1.5 text-[13px] text-text-secondary leading-relaxed">
          Free accounts include 3 crops a day. Upgrade to{" "}
          <span className="text-text-primary font-medium">Unlimited</span> for
          unlimited crops every day.
        </p>

        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={goToPlans}
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white
                       bg-accent rounded-lg hover:bg-accent-hover transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            View plans
          </button>
          <button
            onClick={dismiss}
            className="w-full px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
