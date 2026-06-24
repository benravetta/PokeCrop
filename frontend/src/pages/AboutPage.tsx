import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { MarketingPageShell } from "../components/marketing/MarketingPageShell";
import { ESTIMATE_DISCLAIMER, GRADER_INDEPENDENCE, HERO, SEO } from "../lib/marketingCopy";
import { usePageSeo } from "../lib/seo";

export function AboutPage() {
  usePageSeo(useMemo(() => SEO.about, []));

  return (
    <MarketingPageShell>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent mb-3">About</p>
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
        Built by collectors, for better decisions
      </h1>
      <p className="mt-4 text-base text-text-secondary leading-relaxed">
        GemCheck exists because too many collectors submit cards on hope alone, then pay grading
        fees, wait weeks and get a result that does not match what they expected.
      </p>

      <div className="mt-10 space-y-6 text-sm text-text-secondary leading-relaxed">
        <section>
          <h2 className="text-base font-semibold text-text-primary">What GemCheck helps with</h2>
          <p className="mt-2">
            Upload clear front and back photos to get a practical pre-grade estimate, confidence
            guidance, and the condition factors that matter most (centring, corners, edges and
            surface) before you spend money on submission.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-text-primary">What GemCheck does not do</h2>
          <p className="mt-2">
            We do not issue official grades. {GRADER_INDEPENDENCE}
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-text-primary">Who it is for</h2>
          <p className="mt-2">
            Casual collectors checking one card, ROI-focused flippers, serious bulk submitters and
            trade users who need to triage faster. Card shops, breakers and dealers included.
          </p>
        </section>
      </div>

      <p className="mt-8 text-sm text-text-muted">{ESTIMATE_DISCLAIMER}</p>

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
