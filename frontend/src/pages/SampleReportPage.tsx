import { useMemo } from "react";
import { Link } from "react-router-dom";
import { MarketingPageShell } from "../components/marketing/MarketingPageShell";
import { GuestPrimaryCtaLink } from "../components/marketing/GuestPrimaryCtaLink";
import { ReportPreview } from "../components/landing/ReportPreview";
import { SEO } from "../lib/marketingCopy";
import { usePageSeo } from "../lib/seo";

export function SampleReportPage() {
  usePageSeo(useMemo(() => SEO.sampleReport, []));

  return (
    <MarketingPageShell wide>
      <ReportPreview asPage />
      <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
        <GuestPrimaryCtaLink
          showArrow
          className="inline-flex justify-center rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent-hover transition-colors"
        />
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
