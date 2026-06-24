import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import {
  ESTIMATE_DISCLAIMER,
  SITE_FAQ,
  TRANSPARENCY,
  WHAT_WE_CHECK,
} from "../../lib/marketingCopy";
import { GraderCompareSection } from "../landing/GraderCompareSection";
import { SectionHeading } from "../landing/shared";

export { GraderCompareSection };

export function WhatWeCheckSection() {
  return (
    <section className="py-14 sm:py-16 border-b border-border-subtle bg-surface-raised/20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          kicker={WHAT_WE_CHECK.kicker}
          title={WHAT_WE_CHECK.heading}
          copy={WHAT_WE_CHECK.intro}
        />
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {WHAT_WE_CHECK.items.map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-border-subtle bg-surface-raised p-5"
            >
              <h3 className="text-base font-semibold">{item.label}</h3>
              <p className="mt-1.5 text-sm text-text-secondary leading-relaxed">{item.copy}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-text-muted max-w-2xl mx-auto">
          {WHAT_WE_CHECK.qualification}
        </p>
      </div>
    </section>
  );
}

export function TransparencySection() {
  return (
    <section className="py-14 sm:py-16 border-b border-border-subtle bg-surface-raised/30">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-balance">
          {TRANSPARENCY.heading}
        </h2>
        <p className="mt-4 text-sm text-text-secondary leading-relaxed">{TRANSPARENCY.body}</p>
        <p className="mt-3 text-sm text-text-secondary leading-relaxed">{TRANSPARENCY.body2}</p>
        <p className="mt-6 text-xs text-text-muted">{ESTIMATE_DISCLAIMER}</p>
      </div>
    </section>
  );
}

export function FaqStripSection() {
  const items = SITE_FAQ.slice(0, 4);
  return (
    <section className="py-14 sm:py-16 border-b border-border-subtle">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          kicker="FAQ"
          title="Questions, answered properly"
          copy="Straight answers on estimates, photo quality, card types and next steps."
        />
        <div className="mt-10 grid sm:grid-cols-2 gap-4">
          {items.map((item) => (
            <div key={item.q} className="rounded-2xl border border-border-subtle bg-surface-raised p-5">
              <h3 className="text-sm font-semibold text-text-primary">{item.q}</h3>
              <p className="mt-2 text-sm text-text-secondary leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-text-muted">
          Still not sure?{" "}
          <Link to="/faq" className="text-accent hover:text-accent-hover font-medium">
            Read all FAQs
          </Link>{" "}
          or{" "}
          <Link to="/contact" className="text-accent hover:text-accent-hover font-medium">
            contact us
          </Link>
          .
        </p>
      </div>
    </section>
  );
}

export function TradeTeaserSection() {
  return (
    <section className="py-14 sm:py-16 border-b border-border-subtle bg-surface-raised/30">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="rounded-2xl border border-border-subtle bg-surface-raised p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent mb-2">
              Trade
            </p>
            <h2 className="text-2xl font-semibold tracking-tight">Triage more cards. Waste fewer submissions.</h2>
            <p className="mt-3 text-sm text-text-secondary leading-relaxed">
              Card shops, breakers, dealers and bulk submitters use GemCheck to review more cards,
              set better expectations and move good candidates forward.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <Link
              to="/trade"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent-hover transition-colors"
            >
              Request trade pricing
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/how-it-works"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface-overlay/40 px-6 py-3 text-sm font-semibold text-text-primary hover:bg-surface-overlay transition-colors"
            >
              How it works
            </Link>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-text-muted">{ESTIMATE_DISCLAIMER}</p>
      </div>
    </section>
  );
}
