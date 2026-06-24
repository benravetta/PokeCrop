import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { MarketingPageShell } from "../components/marketing/MarketingPageShell";
import { ESTIMATE_DISCLAIMER, HERO, HOW_IT_WORKS, SEO, WHAT_WE_CHECK } from "../lib/marketingCopy";
import { howToJsonLd, usePageSeo } from "../lib/seo";

export function HowItWorksPage() {
  usePageSeo(
    useMemo(
      () => ({
        ...SEO.howItWorks,
        jsonLd: howToJsonLd(
          HOW_IT_WORKS.heading,
          HOW_IT_WORKS.steps.map((s) => ({ title: s.title, body: s.copy }))
        ),
      }),
      []
    )
  );

  return (
    <MarketingPageShell>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent mb-3">
        {HOW_IT_WORKS.kicker}
      </p>
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-balance">
        {HOW_IT_WORKS.heading}
      </h1>
      <p className="mt-4 text-base text-text-secondary leading-relaxed">{HOW_IT_WORKS.intro}</p>

      <ol className="mt-10 space-y-6">
        {HOW_IT_WORKS.steps.map((step, i) => (
          <li key={step.title} className="rounded-2xl border border-border-subtle bg-surface-raised p-5">
            <span className="text-xs font-semibold text-text-muted">Step {i + 1}</span>
            <h2 className="mt-1 text-lg font-semibold">{step.title}</h2>
            <p className="mt-2 text-sm text-text-secondary leading-relaxed">{step.copy}</p>
          </li>
        ))}
      </ol>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">{WHAT_WE_CHECK.heading}</h2>
        <p className="mt-2 text-sm text-text-secondary">{WHAT_WE_CHECK.intro}</p>
        <div className="mt-4 grid sm:grid-cols-2 gap-3">
          {WHAT_WE_CHECK.items.map((item) => (
            <div key={item.label} className="rounded-xl border border-border-subtle bg-surface-raised p-4">
              <div className="text-sm font-semibold">{item.label}</div>
              <p className="mt-1 text-sm text-text-secondary">{item.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <p className="mt-8 text-sm text-text-muted leading-relaxed">{ESTIMATE_DISCLAIMER}</p>

      <Link
        to="/register"
        className="mt-8 inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent-hover transition-colors"
      >
        {HERO.primaryCtaGuest}
        <ArrowRight className="w-4 h-4" />
      </Link>
    </MarketingPageShell>
  );
}
