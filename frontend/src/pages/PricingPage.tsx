import { useEffect, useState } from "react";
import { Check, Sparkles, Loader2 } from "lucide-react";
import { useMe } from "../hooks/useMe";
import { startCheckout, openBillingPortal } from "../lib/api";

type PlanId = "free" | "unlimited" | "api";

interface Tier {
  id: PlanId;
  name: string;
  price: string;
  cadence?: string;
  blurb: string;
  features: string[];
  highlight?: boolean;
}

const TIERS: Tier[] = [
  {
    id: "free",
    name: "Free",
    price: "£0",
    blurb: "Get started with a few crops a day.",
    features: ["3 crops per day", "Full crop editor", "Original & web exports"],
  },
  {
    id: "unlimited",
    name: "Unlimited",
    price: "£7.99",
    cadence: "/mo",
    blurb: "For sellers and collectors who crop a lot.",
    features: [
      "Unlimited crops",
      "Everything in Free",
      "Priority processing",
    ],
    highlight: true,
  },
  {
    id: "api",
    name: "API access",
    price: "£19.99",
    cadence: "/mo",
    blurb: "Automate cropping in your own tools.",
    features: [
      "Unlimited crops",
      "Everything in Unlimited",
      "API keys (coming soon)",
    ],
  },
];

export function PricingPage() {
  const { me, refresh } = useMe();
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const currentPlan = me?.plan ?? "free";
  const isPaying = currentPlan !== "free";

  const handle = async (tier: Tier) => {
    if (tier.id === "free") return;
    setError(null);
    setBusy(tier.id);
    try {
      // Existing subscribers switch/cancel through the Stripe portal; new
      // subscribers go straight to Checkout.
      const url = isPaying
        ? await openBillingPortal()
        : await startCheckout(tier.id);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(null);
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-5 py-10">
        <div className="text-center mb-9">
          <h1 className="text-2xl font-semibold text-text-primary">
            Simple, fair pricing
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            Crop Pokémon cards perfectly. Upgrade any time.
          </p>
        </div>

        {error && (
          <div className="max-w-md mx-auto mb-6 rounded-lg bg-error/10 border border-error/20 px-3 py-2 text-[13px] text-error text-center">
            {error}
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-3">
          {TIERS.map((tier) => {
            const isCurrent = tier.id === currentPlan;
            return (
              <div
                key={tier.id}
                className={`relative rounded-2xl border p-5 flex flex-col ${
                  tier.highlight
                    ? "border-accent/50 bg-surface-raised shadow-xl"
                    : "border-border-subtle bg-surface-raised"
                }`}
              >
                {tier.highlight && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-[10.5px] font-semibold text-white">
                    <Sparkles className="w-3 h-3" /> Popular
                  </span>
                )}
                <h2 className="text-sm font-semibold text-text-primary">
                  {tier.name}
                </h2>
                <div className="mt-2 flex items-baseline gap-0.5">
                  <span className="text-2xl font-semibold text-text-primary">
                    {tier.price}
                  </span>
                  {tier.cadence && (
                    <span className="text-[13px] text-text-muted">{tier.cadence}</span>
                  )}
                </div>
                <p className="mt-1.5 text-[12.5px] text-text-secondary leading-relaxed">
                  {tier.blurb}
                </p>

                <ul className="mt-4 flex flex-col gap-2 flex-1">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[13px] text-text-secondary">
                      <Check className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="mt-5">
                  {isCurrent ? (
                    <button
                      disabled
                      className="w-full px-4 py-2.5 text-sm font-medium rounded-lg bg-surface-overlay text-text-muted border border-border-subtle cursor-default"
                    >
                      Current plan
                    </button>
                  ) : tier.id === "free" ? (
                    <button
                      disabled
                      className="w-full px-4 py-2.5 text-sm font-medium rounded-lg bg-surface-overlay text-text-muted border border-border-subtle cursor-default"
                    >
                      Included
                    </button>
                  ) : (
                    <button
                      onClick={() => handle(tier)}
                      disabled={busy !== null}
                      className={`w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-60 ${
                        tier.highlight
                          ? "bg-accent text-white hover:bg-accent-hover"
                          : "bg-surface-overlay text-text-primary border border-border-subtle hover:bg-border-subtle"
                      }`}
                    >
                      {busy === tier.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isPaying ? (
                        "Switch plan"
                      ) : (
                        "Upgrade"
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-[11.5px] text-text-muted">
          Prices in GBP. Cancel any time via the billing portal. The £19.99 API tier
          reserves access while the public API is being built.
        </p>
      </div>
    </div>
  );
}
