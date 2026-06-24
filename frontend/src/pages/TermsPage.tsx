import { useMemo } from "react";
import { MarketingPageShell } from "../components/marketing/MarketingPageShell";
import { LegalDocument } from "../components/marketing/LegalDocument";
import { TERMS_OF_SERVICE } from "../lib/legalCopy";
import { SEO } from "../lib/marketingCopy";
import { usePageSeo } from "../lib/seo";

export function TermsPage() {
  usePageSeo(useMemo(() => SEO.terms, []));

  return (
    <MarketingPageShell>
      <LegalDocument doc={TERMS_OF_SERVICE} currentPath="/terms" />
    </MarketingPageShell>
  );
}
