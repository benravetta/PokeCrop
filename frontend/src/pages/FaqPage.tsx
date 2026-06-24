import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { MarketingPageShell } from "../components/marketing/MarketingPageShell";
import { SITE_FAQ, SEO } from "../lib/marketingCopy";

export function FaqPage() {
  useEffect(() => {
    document.title = SEO.faq.title;
  }, []);

  return (
    <MarketingPageShell>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent mb-3">FAQ</p>
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Questions, answered properly</h1>
      <p className="mt-4 text-base text-text-secondary leading-relaxed">
        Straight answers on estimates, photo quality, card types, privacy and next steps.
      </p>

      <div className="mt-10 space-y-4">
        {SITE_FAQ.map((item) => (
          <div key={item.q} className="rounded-2xl border border-border-subtle bg-surface-raised p-5">
            <h2 className="text-sm font-semibold text-text-primary">{item.q}</h2>
            <p className="mt-2 text-sm text-text-secondary leading-relaxed">{item.a}</p>
          </div>
        ))}
      </div>

      <p className="mt-8 text-sm text-text-muted">
        Still not sure?{" "}
        <Link to="/contact" className="text-accent hover:text-accent-hover font-medium">
          Send us a message
        </Link>
        .
      </p>

      <Link
        to="/register"
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent-hover transition-colors"
      >
        Check a card
        <ArrowRight className="w-4 h-4" />
      </Link>
    </MarketingPageShell>
  );
}
