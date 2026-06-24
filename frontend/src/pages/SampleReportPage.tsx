import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { MarketingPageShell } from "../components/marketing/MarketingPageShell";
import { ReportPreview } from "../components/landing/ReportPreview";
import { HERO, SEO } from "../lib/marketingCopy";

export function SampleReportPage() {
  useEffect(() => {
    document.title = SEO.sampleReport.title;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", SEO.sampleReport.description);
  }, []);

  return (
    <MarketingPageShell wide>
      <ReportPreview asPage />
      <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          to="/register"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent-hover transition-colors"
        >
          {HERO.primaryCtaGuest}
          <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          to="/how-it-works"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface-raised/60 px-6 py-3 text-sm font-semibold text-text-primary hover:bg-surface-overlay transition-colors"
        >
          How it works
        </Link>
      </div>
    </MarketingPageShell>
  );
}
