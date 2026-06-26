import { Check } from "lucide-react";
import { Link } from "react-router-dom";
import { ESTIMATE_DISCLAIMER_SHORT, WAITLIST } from "../../lib/marketingCopy";

export function WaitlistBenefitsPanel() {
  return (
    <aside className="rounded-2xl border border-border-subtle bg-surface-raised/60 p-6 lg:p-7">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent mb-3">
        {WAITLIST.heroEyebrow}
      </p>
      <h1 className="text-2xl sm:text-[1.65rem] font-semibold tracking-tight text-balance leading-snug">
        {WAITLIST.heroTitle}
      </h1>
      <p className="mt-3 text-[14px] text-text-secondary leading-relaxed">{WAITLIST.heroBody}</p>

      <ol className="mt-8 space-y-4">
        {WAITLIST.steps.map((step, i) => (
          <li key={step.title} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-overlay text-[11px] font-semibold text-text-muted border border-border-subtle">
              {i + 1}
            </span>
            <div>
              <p className="text-[13px] font-semibold text-text-primary">{step.title}</p>
              <p className="mt-0.5 text-[13px] text-text-secondary leading-relaxed">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <ul className="mt-8 pt-6 border-t border-border-subtle space-y-2.5">
        {WAITLIST.perks.map((perk) => (
          <li key={perk} className="flex gap-2.5 text-[13px] text-text-secondary">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={2.5} />
            {perk}
          </li>
        ))}
      </ul>

      <p className="mt-6 text-[12px] text-text-muted leading-relaxed">{ESTIMATE_DISCLAIMER_SHORT}</p>

      <p className="mt-4 text-[13px] text-text-secondary">
        Already invited?{" "}
        <Link to="/login" className="text-accent hover:text-accent-hover font-medium">
          Sign in
        </Link>
        {" · "}
        <Link to="/sample-report" className="text-accent hover:text-accent-hover font-medium">
          Sample report
        </Link>
      </p>
    </aside>
  );
}
