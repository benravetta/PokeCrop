import { Link } from "react-router-dom";
import { ArrowRight, Check, FileText, Tag } from "lucide-react";
import { PRICING_TIERS, SINGLE_GRADE } from "./data";
import { isProLaunchPromoActive, PRO_LAUNCH_PROMO } from "../pricing/pricingCompare";
import type { Plan, SubscriptionPlan } from "../../lib/plans";
import { PRICING, NAV } from "../../lib/marketingCopy";
import { guestPrimaryCtaLabel, guestSignupPath, useInviteRequired } from "../../hooks/useInviteRequired";
import { SectionHeading } from "./shared";
import { STAFF_ACCOUNT } from "../../lib/adminAccess";
import { StaffIncludedLabel } from "../staff/StaffIncludedLabel";

export function SingleGradeOffer({
  loggedIn,
  onBuyGrade,
}: {
  loggedIn: boolean;
  onBuyGrade: () => void;
}) {
  const { inviteRequired } = useInviteRequired();

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-raised p-6 sm:p-8">
      <div className="flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-10">
        <div className="flex-1 min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface-overlay/50 px-2.5 py-1 text-[11px] font-medium text-text-secondary">
            <FileText className="w-3 h-3 text-accent" />
            Pay as you go
          </div>
          <h3 className="mt-3 text-xl sm:text-2xl font-semibold tracking-tight">
            Just need one report?
          </h3>
          <p className="mt-2 text-sm text-text-secondary leading-relaxed max-w-xl">
            Checking a single card before you submit? Buy one full pre-grade — same PDF as a
            subscription grade, no monthly plan required.
          </p>
          <ul className="mt-4 grid sm:grid-cols-2 gap-x-4 gap-y-2">
            {SINGLE_GRADE.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-text-secondary">
                <Check className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="shrink-0 flex flex-col items-stretch sm:items-center lg:items-end gap-3 lg:min-w-[200px]">
          <div className="text-center lg:text-right">
            <div className="text-3xl font-semibold tracking-tight">{SINGLE_GRADE.price}</div>
            <div className="text-sm text-text-muted">one-time</div>
          </div>
          {loggedIn ? (
            <button
              onClick={onBuyGrade}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20"
            >
              Buy one grade
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <Link
              to={guestSignupPath(inviteRequired)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20"
            >
              {inviteRequired ? NAV.joinWaitlist : "Sign up to buy"}
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
          <p className="text-[11px] text-text-muted text-center lg:text-right">
            {loggedIn
              ? "Credit added instantly after checkout."
              : inviteRequired
                ? "Join the waitlist — we'll email you when approved."
                : "Free account required — takes 30 seconds."}
          </p>
        </div>
      </div>
    </div>
  );
}

export function PricingSection({
  loggedIn,
  plan,
  isAdmin = false,
  onUpgrade,
  onBuyGrade,
}: {
  loggedIn: boolean;
  plan: Plan | null;
  isAdmin?: boolean;
  onUpgrade: (plan: SubscriptionPlan) => void;
  onBuyGrade: () => void;
}) {
  const proPromoLive = isProLaunchPromoActive();

  return (
    <section id="pricing" className="scroll-mt-20 py-16 sm:py-24">
      <div className="mx-auto w-full max-w-6xl page-x">
        <SectionHeading
          kicker="Pricing"
          title={PRICING.heading}
          copy={PRICING.body}
        />

        {proPromoLive && (
          <p className="mt-4 text-center text-[12.5px] text-accent">
            <Tag className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
            Pro launch: {PRO_LAUNCH_PROMO.code} — {PRO_LAUNCH_PROMO.headline} (new customers, until
            1 Aug)
          </p>
        )}

        {isAdmin && (
          <p className="mt-6 text-center text-sm text-text-muted">{STAFF_ACCOUNT.pricingFootnote}</p>
        )}

        <div className="mt-8">
          {!isAdmin && <SingleGradeOffer loggedIn={loggedIn} onBuyGrade={onBuyGrade} />}
        </div>

        <p className="mt-10 text-center text-xs font-semibold uppercase tracking-wider text-text-muted">
          Or subscribe
        </p>

        <div className="mt-6 grid sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-5">
          {PRICING_TIERS.map((tier) => {
            const isCurrent =
              !isAdmin &&
              loggedIn &&
              plan !== null &&
              ((tier.id === "free" && plan === "free") ||
                (tier.id === "unlimited" && plan === "unlimited") ||
                (tier.id === "pro" && plan === "pro") ||
                (tier.id === "api" && plan === "api"));

            return (
              <div
                key={tier.id}
                className={`relative flex flex-col rounded-2xl border p-6 ${
                  tier.highlight
                    ? "border-accent/50 bg-surface-raised shadow-xl shadow-accent/10 ring-1 ring-accent/20"
                    : "border-border-subtle bg-surface-raised"
                }`}
              >
                {tier.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-0.5 text-[11px] font-semibold text-white whitespace-nowrap">
                    Most popular
                  </span>
                )}
                {tier.id === "pro" && proPromoLive && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 px-3 py-0.5 text-[11px] font-semibold text-white whitespace-nowrap">
                    {PRO_LAUNCH_PROMO.code} · 50% off 3 mo
                  </span>
                )}
                <div className="text-sm font-medium text-text-secondary">{tier.name}</div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold tracking-tight">{tier.price}</span>
                  <span className="text-sm text-text-muted">/{tier.period}</span>
                </div>
                <ul className="mt-5 space-y-2.5 flex-1">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-text-secondary">
                      <Check className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  {isAdmin ? (
                    <StaffIncludedLabel />
                  ) : isCurrent ? (
                    <span className="block w-full rounded-xl border border-border-strong py-2.5 text-sm font-medium text-center text-text-muted">
                      Current plan
                    </span>
                  ) : tier.id !== "free" && loggedIn ? (
                    <button
                      onClick={() => onUpgrade(tier.id as SubscriptionPlan)}
                      className={`block w-full rounded-xl py-2.5 text-sm font-semibold text-center transition-colors ${
                        tier.highlight
                          ? "bg-accent text-white hover:bg-accent-hover shadow-lg shadow-accent/20"
                          : "border border-border-strong text-text-primary hover:bg-surface-overlay"
                      }`}
                    >
                      {tier.cta}
                    </button>
                  ) : (
                    <Link
                      to={tier.ctaTo}
                      className={`block w-full rounded-xl py-2.5 text-sm font-semibold text-center transition-colors ${
                        tier.highlight
                          ? "bg-accent text-white hover:bg-accent-hover shadow-lg shadow-accent/20"
                          : "border border-border-strong text-text-primary hover:bg-surface-overlay"
                      }`}
                    >
                      {tier.cta}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-sm text-text-muted">
          <Link to="/pricing" className="text-accent hover:text-accent-hover">
            Compare all plans in detail
          </Link>
        </p>
      </div>
    </section>
  );
}

export function PlanCta({
  loggedIn,
  plan,
  isAdmin = false,
  onUpgrade,
  onBuyGrade,
}: {
  loggedIn: boolean;
  plan: Plan | null;
  isAdmin?: boolean;
  onUpgrade: (plan: SubscriptionPlan) => void;
  onBuyGrade: () => void;
}) {
  const { inviteRequired } = useInviteRequired();
  let title: string;
  let copy: string;
  let primary: { label: string; onClick?: () => void; to?: string };
  let secondary: { label: string; onClick?: () => void; to?: string } | null = {
    label: "See pricing",
    to: "/pricing",
  };

  if (isAdmin) {
    title = STAFF_ACCOUNT.planCta.title;
    copy = STAFF_ACCOUNT.planCta.copy;
    primary = { label: STAFF_ACCOUNT.planCta.primary, to: "/crop" };
    secondary = { label: STAFF_ACCOUNT.planCta.secondary, to: "/admin" };
  } else if (!loggedIn) {
    title = inviteRequired
      ? "Join the waitlist for early access."
      : "Check a card before you ever pay to grade.";
    copy = inviteRequired
      ? "GemCheck is invite-only during beta. Request access and we'll email you a registration link if approved."
      : `Free to start — or buy a single report for ${SINGLE_GRADE.price} with no subscription.`;
    primary = {
      label: guestPrimaryCtaLabel(inviteRequired),
      to: guestSignupPath(inviteRequired),
    };
    secondary = { label: "See pricing", to: "/pricing" };
  } else if (plan === "free") {
    title = "Need more than one grade a month?";
    copy = `Premium is £9.99/mo for 30 reports, or buy a single report for ${SINGLE_GRADE.price}.`;
    primary = { label: "Go Premium", onClick: () => onUpgrade("unlimited") };
    secondary = { label: `Buy one grade — ${SINGLE_GRADE.price}`, onClick: onBuyGrade };
  } else if (plan === "unlimited") {
    title = "Grading at volume?";
    copy = "Pro adds 100 reports per month and priority processing — or jump to Enterprise for API access.";
    primary = { label: "Upgrade to Pro", onClick: () => onUpgrade("pro") };
    secondary = { label: "Compare plans", to: "/pricing" };
  } else if (plan === "pro") {
    title = "Automate with the Enterprise plan.";
    copy = "Everything in Pro plus REST API access, self-serve keys, and bulk crop automation.";
    primary = { label: "Upgrade to Enterprise", onClick: () => onUpgrade("api") };
    secondary = { label: "View the API docs", to: "/docs" };
  } else if (plan === "api") {
    title = "You're on Enterprise.";
    copy = "Manage your keys and usage, or jump straight into the app.";
    primary = { label: "Open the app", to: "/crop" };
    secondary = { label: "Manage API keys", to: "/account" };
  } else {
    title = "Manage your subscription.";
    copy = "View plans, billing, and usage on your account page.";
    primary = { label: "Account settings", to: "/account" };
  }

  return (
    <section className="relative overflow-hidden border-t border-border-subtle landing-mesh">
      <div className="relative mx-auto w-full max-w-4xl page-x py-20 sm:py-28 text-center">
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-balance">{title}</h2>
        <p className="mt-4 text-text-secondary max-w-xl mx-auto leading-relaxed">{copy}</p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          {primary.to ? (
            <Link
              to={primary.to}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-7 py-3.5 text-sm font-semibold text-white hover:bg-accent-hover transition-colors shadow-lg shadow-accent/25"
            >
              {primary.label}
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <button
              onClick={primary.onClick}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-7 py-3.5 text-sm font-semibold text-white hover:bg-accent-hover transition-colors shadow-lg shadow-accent/25"
            >
              {primary.label}
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
          {secondary &&
            (secondary.to ? (
              <Link
                to={secondary.to}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface-raised/60 px-7 py-3.5 text-sm font-semibold text-text-primary hover:bg-surface-overlay transition-colors"
              >
                {secondary.label}
              </Link>
            ) : (
              <button
                onClick={secondary.onClick}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface-raised/60 px-7 py-3.5 text-sm font-semibold text-text-primary hover:bg-surface-overlay transition-colors"
              >
                {secondary.label}
              </button>
            ))}
        </div>
      </div>
    </section>
  );
}
