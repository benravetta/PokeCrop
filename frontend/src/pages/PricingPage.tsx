import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Sparkles, Loader2, Tag } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useMe } from "../hooks/useMe";
import { startCheckout, startGradeCheckout, openBillingPortal } from "../lib/api";
import type { Plan } from "../lib/plans";
import { AdminAccessNotice, isAdminMe } from "../lib/adminAccess";
import { SingleGradeOffer } from "../components/landing/PricingSection";
import { FeatureCompareTable } from "../components/pricing/FeatureCompareTable";
import {
  PRICING_FAQ,
  PRO_LAUNCH_PROMO,
  SUBSCRIPTION_TIERS,
  isProLaunchPromoActive,
  type PlanColumn,
  type SubscriptionPlanId,
} from "../components/pricing/pricingCompare";
import { SEO } from "../lib/marketingCopy";

export function PricingPage() {
  const session = useAuth((s) => s.session);
  const loggedIn = !!session;
  const { me, refresh } = useMe();
  const [busy, setBusy] = useState<SubscriptionPlanId | null>(null);
  const [gradeBusy, setGradeBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const proPromoLive = isProLaunchPromoActive();

  useEffect(() => {
    refresh();
    document.title = SEO.pricing.title;
  }, [refresh]);

  const currentPlan: Plan = me?.plan ?? "free";
  const admin = isAdminMe(me);
  const isPaying = !admin && currentPlan !== "free";
  const highlightPlan: PlanColumn | undefined =
    currentPlan === "free" ||
    currentPlan === "unlimited" ||
    currentPlan === "pro" ||
    currentPlan === "api"
      ? currentPlan
      : undefined;

  const handleUpgrade = async (tierId: SubscriptionPlanId) => {
    if (admin) return;
    setError(null);
    setBusy(tierId);
    try {
      const url = isPaying ? await openBillingPortal() : await startCheckout(tierId);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(null);
    }
  };

  const handleBuyGrade = async () => {
    if (admin) return;
    setError(null);
    setGradeBusy(true);
    try {
      const { url } = await startGradeCheckout();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setGradeBusy(false);
    }
  };

  return (
    <div className="min-h-0 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-5 py-10 sm:py-12">
        <div className="text-center mb-10">
          <h1 className="text-2xl sm:text-3xl font-semibold text-text-primary tracking-tight">
            Simple pricing for smarter submissions
          </h1>
          <p className="mt-3 text-sm sm:text-base text-text-secondary max-w-xl mx-auto leading-relaxed">
            Choose the plan that fits your stack, from one-off checks to regular grading triage.
            Cancel any time — no hostage situations.
          </p>
          {proPromoLive && (
            <p className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[12.5px] text-accent">
              <Tag className="w-3.5 h-3.5" />
              Pro launch: code <span className="font-semibold">{PRO_LAUNCH_PROMO.code}</span> —{" "}
              {PRO_LAUNCH_PROMO.headline} (new customers, until 1 Aug)
            </p>
          )}
        </div>

        {admin && (
          <div className="max-w-2xl mx-auto mb-8">
            <AdminAccessNotice />
          </div>
        )}

        {error && (
          <div className="max-w-md mx-auto mb-6 rounded-lg bg-error/10 border border-error/20 px-3 py-2 text-[13px] text-error text-center">
            {error}
          </div>
        )}

        {admin ? (
          <p className="mb-8 text-center text-sm text-text-muted">
            Pricing below is for customer accounts. Your admin account already has full access.
          </p>
        ) : gradeBusy ? (
          <div className="mb-8 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
          </div>
        ) : (
          <SingleGradeOffer loggedIn={loggedIn && !admin} onBuyGrade={handleBuyGrade} />
        )}

        <p className="mt-12 mb-6 text-center text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          Subscriptions
        </p>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {SUBSCRIPTION_TIERS.map((tier) => {
            const isCurrent = !admin && tier.id === currentPlan;
            const showProPromo = tier.id === "pro" && proPromoLive && tier.promo;
            return (
              <div
                key={tier.id}
                className={`relative rounded-2xl border p-5 sm:p-6 flex flex-col ${
                  tier.highlight
                    ? "border-accent/50 bg-surface-raised shadow-xl shadow-accent/5 ring-1 ring-accent/20"
                    : "border-border-subtle bg-surface-raised"
                }`}
              >
                {tier.highlight && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-[10.5px] font-semibold text-white">
                    <Sparkles className="w-3 h-3" /> Most popular
                  </span>
                )}
                {showProPromo && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10.5px] font-semibold text-white whitespace-nowrap">
                    <Tag className="w-3 h-3" /> {PRO_LAUNCH_PROMO.code} · {tier.promo}
                  </span>
                )}
                <h2 className="text-sm font-semibold text-text-primary">{tier.name}</h2>
                <div className="mt-2 flex items-baseline gap-0.5">
                  <span className="text-2xl sm:text-3xl font-semibold text-text-primary">
                    {tier.price}
                  </span>
                  {tier.cadence && (
                    <span className="text-[13px] text-text-muted">{tier.cadence}</span>
                  )}
                </div>
                <p className="mt-2 text-[12.5px] text-text-secondary leading-relaxed">
                  {tier.blurb}
                </p>
                {showProPromo && (
                  <p className="mt-2 text-[11.5px] text-emerald-400/90 leading-snug">
                    {PRO_LAUNCH_PROMO.detail}
                  </p>
                )}

                <ul className="mt-5 flex flex-col gap-2.5 flex-1">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[13px] text-text-secondary">
                      <Check className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="mt-6">
                  {admin ? (
                    <button
                      disabled
                      className="w-full px-4 py-2.5 text-sm font-medium rounded-xl bg-amber-500/10 text-amber-200/80 border border-amber-500/30 cursor-default"
                    >
                      Admin — included
                    </button>
                  ) : isCurrent ? (
                    <button
                      disabled
                      className="w-full px-4 py-2.5 text-sm font-medium rounded-xl bg-surface-overlay text-text-muted border border-border-subtle cursor-default"
                    >
                      Current plan
                    </button>
                  ) : tier.id === "free" ? (
                    loggedIn ? (
                      <button
                        disabled
                        className="w-full px-4 py-2.5 text-sm font-medium rounded-xl bg-surface-overlay text-text-muted border border-border-subtle cursor-default"
                      >
                        Included
                      </button>
                    ) : (
                      <Link
                        to="/register"
                        className="block w-full text-center px-4 py-2.5 text-sm font-semibold rounded-xl bg-surface-overlay text-text-primary border border-border-subtle hover:bg-border-subtle transition-colors"
                      >
                        Start free
                      </Link>
                    )
                  ) : (
                    <button
                      onClick={() => handleUpgrade(tier.id)}
                      disabled={busy !== null}
                      className={`w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 ${
                        tier.highlight
                          ? "bg-accent text-white hover:bg-accent-hover shadow-lg shadow-accent/20"
                          : "bg-surface-overlay text-text-primary border border-border-subtle hover:bg-border-subtle"
                      }`}
                    >
                      {busy === tier.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isPaying ? (
                        "Switch plan"
                      ) : (
                        `Upgrade to ${tier.name}`
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <section className="mt-14 sm:mt-16">
          <div className="text-center mb-8">
            <h2 className="text-lg sm:text-xl font-semibold text-text-primary">
              Compare plans
            </h2>
            <p className="mt-2 text-sm text-text-secondary max-w-lg mx-auto">
              Every plan includes the same full pre-grade report. Subscriptions add volume;
              pay-as-you-go is there when you only need one more check.
            </p>
          </div>
          <div className="rounded-2xl border border-border-subtle bg-surface-raised p-4 sm:p-6">
            <FeatureCompareTable highlightPlan={highlightPlan} />
          </div>
        </section>

        <section className="mt-14 sm:mt-16">
          <h2 className="text-lg sm:text-xl font-semibold text-text-primary text-center mb-8">
            Common questions
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 max-w-4xl mx-auto">
            {PRICING_FAQ.map((item) => (
              <div
                key={item.q}
                className="rounded-xl border border-border-subtle bg-surface-raised p-4 sm:p-5"
              >
                <h3 className="text-sm font-semibold text-text-primary">{item.q}</h3>
                <p className="mt-2 text-[13px] text-text-secondary leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <p className="mt-12 text-center text-[11.5px] text-text-muted leading-relaxed max-w-2xl mx-auto">
          All prices in GBP. Subscriptions cancel any time via the billing portal — no lock-in.
          Single-grade purchases are one-off; credit stays on your account until you use it.
          {!loggedIn && (
            <>
              {" "}
              <Link to="/register" className="text-accent hover:text-accent-hover">
                Check a card free
              </Link>{" "}
              to get started.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
