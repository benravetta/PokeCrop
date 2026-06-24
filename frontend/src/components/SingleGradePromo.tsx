import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CreditCard, FileText, Loader2, ScanSearch } from "lucide-react";
import { useMe } from "../hooks/useMe";
import { startGradeCheckout } from "../lib/api";
import { SINGLE_GRADE } from "./landing/data";
import { isAdminMe } from "../lib/adminAccess";

async function buyGrade(setBusy: (v: boolean) => void) {
  setBusy(true);
  try {
    const { url } = await startGradeCheckout();
    window.location.href = url;
  } catch {
    setBusy(false);
  }
}

export function SingleGradePromo({
  compact = false,
  className = "",
}: {
  compact?: boolean;
  className?: string;
}) {
  const { me } = useMe();
  const [busy, setBusy] = useState(false);

  if (!me || me.plan !== "free" || isAdminMe(me)) return null;

  if (compact) {
    return (
      <div
        className={`mx-4 sm:mx-5 mb-2 rounded-xl border border-accent/25 bg-accent/5 px-3 py-2.5 sm:px-4 sm:py-3 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between ${className}`}
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary">Pre-grade before you submit</p>
          <p className="text-xs text-text-secondary mt-0.5">
            1 free report every month — extra reports {SINGLE_GRADE.price} each, no subscription.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link
            to="/grade"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-overlay px-3 py-2 text-xs font-medium text-text-primary hover:bg-border-subtle transition-colors"
          >
            <ScanSearch className="w-3.5 h-3.5" />
            Check a card
          </Link>
          <button
            onClick={() => buyGrade(setBusy)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white hover:bg-accent-hover transition-colors disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CreditCard className="w-3.5 h-3.5" />
            )}
            Buy one — {SINGLE_GRADE.price}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border border-border-subtle bg-surface-raised p-5 sm:p-6 ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
        <div className="flex-1 min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface-overlay/50 px-2.5 py-1 text-[11px] font-medium text-text-secondary">
            <FileText className="w-3 h-3 text-accent" />
            Pre-grade
          </div>
          <h3 className="mt-3 text-base font-semibold text-text-primary">
            Worth submitting? Check before you post it off.
          </h3>
          <p className="mt-1.5 text-sm text-text-secondary leading-relaxed">
            Get estimates across PSA, Beckett, CGC and more — plus a prep checklist — as a PDF.
            Your free plan includes 1 report a month; need another? Pay {SINGLE_GRADE.price} once,
            no subscription.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-stretch sm:min-w-[168px] shrink-0">
          <Link
            to="/grade"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover transition-colors"
          >
            <ScanSearch className="w-4 h-4" />
            Check a card
            <ArrowRight className="w-4 h-4" />
          </Link>
          <button
            onClick={() => buyGrade(setBusy)}
            disabled={busy}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 px-4 py-2.5 text-sm font-medium text-accent hover:bg-accent/20 transition-colors disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CreditCard className="w-4 h-4" />
            )}
            Buy one — {SINGLE_GRADE.price}
          </button>
        </div>
      </div>
    </div>
  );
}
