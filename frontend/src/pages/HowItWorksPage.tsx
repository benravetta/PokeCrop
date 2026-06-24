import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { MarketingPageShell } from "../components/marketing/MarketingPageShell";
import { ESTIMATE_DISCLAIMER, SEO, WHAT_WE_CHECK } from "../lib/marketingCopy";

export function HowItWorksPage() {
  useEffect(() => {
    document.title = SEO.howItWorks.title;
  }, []);

  return (
    <MarketingPageShell>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent mb-3">
        How it works
      </p>
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-balance">
        From photo to pre-grade
      </h1>
      <p className="mt-4 text-base text-text-secondary leading-relaxed">
        GemCheck reviews your card images against the condition details collectors actually care
        about — then helps you decide whether submitting is worth the fees and wait.
      </p>

      <ol className="mt-10 space-y-6">
        {[
          {
            title: "Upload front and back photos",
            copy: "Use a plain background, natural light and no flash. A phone photo on a desk is fine.",
          },
          {
            title: "We check image quality first",
            copy: "Blurry, cropped or glare-heavy photos weaken the estimate. We tell you when to retake.",
          },
          {
            title: "You get a pre-grade estimate plus confidence",
            copy: "See likely outcomes across PSA, Beckett, CGC and more, with the biggest risk factors called out.",
          },
          {
            title: "Decide whether to submit",
            copy: "Strong submission candidate, borderline, or probably not worth grading yet — with reasons, not just a number.",
          },
        ].map((step, i) => (
          <li key={step.title} className="rounded-2xl border border-border-subtle bg-surface-raised p-5">
            <span className="text-xs font-semibold text-text-muted">Step {i + 1}</span>
            <h2 className="mt-1 text-lg font-semibold">{step.title}</h2>
            <p className="mt-2 text-sm text-text-secondary leading-relaxed">{step.copy}</p>
          </li>
        ))}
      </ol>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">What we check</h2>
        <div className="mt-4 grid sm:grid-cols-2 gap-3">
          {WHAT_WE_CHECK.map((item) => (
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
        Check a card now
        <ArrowRight className="w-4 h-4" />
      </Link>
    </MarketingPageShell>
  );
}
