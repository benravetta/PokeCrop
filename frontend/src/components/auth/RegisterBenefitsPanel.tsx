import { Check } from "lucide-react";
import { Link } from "react-router-dom";
import { SUBSCRIPTION_TIERS } from "../pricing/pricingCompare";

const freeTier = SUBSCRIPTION_TIERS.find((t) => t.id === "free")!;

export function RegisterBenefitsPanel() {
  return (
    <aside className="rounded-2xl border border-border-subtle bg-surface-raised/60 p-6 lg:p-7 shadow-2xl">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-accent">
          Free plan
        </span>
        <span className="text-[12px] text-text-muted">
          {freeTier.price} · {freeTier.cadence}
        </span>
      </div>

      <h2 className="text-base font-semibold text-text-primary tracking-tight">
        What you get on a free account
      </h2>
      <p className="mt-2 text-[13px] text-text-secondary leading-relaxed">
        {freeTier.blurb}
      </p>

      <ul className="mt-5 space-y-3">
        {freeTier.features.map((feature) => (
          <li key={feature} className="flex gap-2.5 text-[13px] text-text-secondary leading-snug">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15">
              <Check className="h-3 w-3 text-accent" strokeWidth={2.5} />
            </span>
            {feature}
          </li>
        ))}
      </ul>

      <p className="mt-6 pt-5 border-t border-border-subtle text-[12px] text-text-muted leading-relaxed">
        No card required. Upgrade anytime for unlimited crops, more pre-grades, or API access —{" "}
        <Link to="/pricing" className="text-accent hover:text-accent-hover font-medium">
          see pricing
        </Link>
        .
      </p>
    </aside>
  );
}
