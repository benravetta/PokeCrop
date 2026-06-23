import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { PRICING_TIERS } from "./data";
import { SectionHeading } from "./shared";

type Plan = "free" | "unlimited" | "api" | null;

export function PricingSection({
  loggedIn,
  plan,
  onUpgrade,
}: {
  loggedIn: boolean;
  plan: Plan;
  onUpgrade: (plan: "unlimited" | "api") => void;
}) {
  return (
    <section id="pricing" className="scroll-mt-20 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          kicker="Simple pricing"
          title="Start free. Upgrade when you're ready."
          copy="No card details to sign up. One free grade every month — enough to see if it's worth submitting."
        />

        <div className="mt-12 grid md:grid-cols-3 gap-4 lg:gap-6">
          {PRICING_TIERS.map((tier) => {
            const isCurrent =
              loggedIn &&
              ((tier.id === "free" && plan === "free") ||
                (tier.id === "unlimited" && plan === "unlimited") ||
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
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-0.5 text-[11px] font-semibold text-white">
                    Most popular
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
                  {isCurrent ? (
                    <span className="block w-full rounded-xl border border-border-strong py-2.5 text-sm font-medium text-center text-text-muted">
                      Current plan
                    </span>
                  ) : tier.id === "unlimited" && loggedIn && plan === "free" ? (
                    <button
                      onClick={() => onUpgrade("unlimited")}
                      className={`block w-full rounded-xl py-2.5 text-sm font-semibold text-center transition-colors ${
                        tier.highlight
                          ? "bg-accent text-white hover:bg-accent-hover shadow-lg shadow-accent/20"
                          : "border border-border-strong text-text-primary hover:bg-surface-overlay"
                      }`}
                    >
                      {tier.cta}
                    </button>
                  ) : tier.id === "api" && loggedIn && plan === "unlimited" ? (
                    <button
                      onClick={() => onUpgrade("api")}
                      className="block w-full rounded-xl border border-border-strong py-2.5 text-sm font-semibold text-center text-text-primary hover:bg-surface-overlay transition-colors"
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

        <p className="mt-6 text-center text-sm text-text-muted">
          Need a one-off grade?{" "}
          <Link to="/account" className="text-accent hover:text-accent-hover">
            Buy a single report for £2.99
          </Link>{" "}
          — or{" "}
          <Link to="/pricing" className="text-accent hover:text-accent-hover">
            see full pricing details
          </Link>
          .
        </p>
      </div>
    </section>
  );
}

export function PlanCta({
  loggedIn,
  plan,
  onUpgrade,
}: {
  loggedIn: boolean;
  plan: Plan;
  onUpgrade: (plan: "unlimited" | "api") => void;
}) {
  let title: string;
  let copy: string;
  let primary: { label: string; onClick?: () => void; to?: string };
  let secondary: { label: string; to: string } | null = { label: "See full pricing", to: "/pricing" };

  if (!loggedIn) {
    title = "Check a card before you ever pay to grade.";
    copy = "Free to start — 1 grade a month and 3 crops a day. No card details to sign up.";
    primary = { label: "Create a free account", to: "/register" };
  } else if (plan === "free") {
    title = "Grade more, gamble less — £7.99/mo.";
    copy = "Unlimited crops and up to 10 grading reports a day, no daily crop cap.";
    primary = { label: "Upgrade to Unlimited", onClick: () => onUpgrade("unlimited") };
  } else if (plan === "unlimited") {
    title = "Add API access for £19.99/mo.";
    copy = "Everything in Unlimited, plus programmatic cropping for automation and bulk work.";
    primary = { label: "Upgrade to API", onClick: () => onUpgrade("api") };
    secondary = { label: "View the API docs", to: "/docs" };
  } else {
    title = "You're on the API plan.";
    copy = "Manage your keys and usage, or jump straight into the app.";
    primary = { label: "Open the app", to: "/crop" };
    secondary = { label: "Manage API keys", to: "/account" };
  }

  return (
    <section className="relative overflow-hidden border-t border-border-subtle landing-mesh">
      <div className="relative mx-auto max-w-4xl px-4 sm:px-6 py-20 sm:py-28 text-center">
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
          {secondary && (
            <Link
              to={secondary.to}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface-raised/60 px-7 py-3.5 text-sm font-semibold text-text-primary hover:bg-surface-overlay transition-colors"
            >
              {secondary.label}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
