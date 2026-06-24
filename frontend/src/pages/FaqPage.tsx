import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { MarketingPageShell } from "../components/marketing/MarketingPageShell";
import { HERO, SITE_FAQ, SEO } from "../lib/marketingCopy";
import { faqJsonLd, usePageSeo } from "../lib/seo";

function FaqAnswer({ q, a }: { q: string; a: string }) {
  if (q === "What happens to my photos?") {
    return (
      <>
        {a} See our{" "}
        <Link to="/privacy" className="text-accent hover:text-accent-hover font-medium">
          privacy policy
        </Link>{" "}
        for full details.
      </>
    );
  }
  if (q === "Can I request a refund?") {
    return (
      <>
        {a} See our{" "}
        <Link to="/refund" className="text-accent hover:text-accent-hover font-medium">
          refund policy
        </Link>{" "}
        for details.
      </>
    );
  }
  return a;
}

export function FaqPage() {
  usePageSeo(
    useMemo(
      () => ({
        ...SEO.faq,
        jsonLd: faqJsonLd(SITE_FAQ),
      }),
      []
    )
  );

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
            <p className="mt-2 text-sm text-text-secondary leading-relaxed">
              <FaqAnswer q={item.q} a={item.a} />
            </p>
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
        {HERO.primaryCtaGuest}
        <ArrowRight className="w-4 h-4" />
      </Link>
    </MarketingPageShell>
  );
}
