import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { MarketingPageShell } from "../components/marketing/MarketingPageShell";
import { SEO } from "../lib/marketingCopy";

export function TradePage() {
  const [sent, setSent] = useState(false);

  useEffect(() => {
    document.title = SEO.trade.title;
  }, []);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <MarketingPageShell>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent mb-3">Trade</p>
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
        Built for busy card businesses
      </h1>
      <p className="mt-4 text-base text-text-secondary leading-relaxed">
        GemCheck helps trade users triage more cards, set better expectations and move faster —
        for card shops, breakers, dealers and submission services.
      </p>

      <ul className="mt-8 space-y-3 text-sm text-text-secondary">
        {[
          "Review more cards without guessing on every borderline raw card",
          "Set customer expectations before they pay to submit",
          "Use the same pre-grade engine as the web app, at scale via API on Enterprise",
        ].map((item) => (
          <li key={item} className="flex gap-2">
            <span className="text-accent shrink-0">·</span>
            {item}
          </li>
        ))}
      </ul>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Request trade pricing</h2>
        {sent ? (
          <p className="mt-4 text-sm text-success">
            Thanks — we will reply like humans, not like a support labyrinth.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-4 space-y-4">
            <label className="block">
              <span className="block text-sm font-medium text-text-primary mb-1.5">Your name</span>
              <input
                required
                className="w-full rounded-lg bg-surface-overlay border border-border-subtle px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-text-primary mb-1.5">Email</span>
              <input
                type="email"
                required
                className="w-full rounded-lg bg-surface-overlay border border-border-subtle px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-text-primary mb-1.5">
                Business type
              </span>
              <input
                required
                placeholder="Shop, breaker, dealer, submission service…"
                className="w-full rounded-lg bg-surface-overlay border border-border-subtle px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-text-primary mb-1.5">
                Rough monthly card volume
              </span>
              <input
                required
                placeholder="Ballpark is fine"
                className="w-full rounded-lg bg-surface-overlay border border-border-subtle px-3 py-2.5 text-sm"
              />
            </label>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent-hover transition-colors"
            >
              Request trade pricing
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}
      </section>

      <p className="mt-8 text-sm text-text-muted">
        Collectors on a personal account?{" "}
        <Link to="/pricing" className="text-accent hover:text-accent-hover font-medium">
          See consumer pricing
        </Link>
        .
      </p>
    </MarketingPageShell>
  );
}
