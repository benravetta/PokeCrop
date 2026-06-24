import { useMemo } from "react";
import { MarketingPageShell } from "../components/marketing/MarketingPageShell";
import { LegalDocument } from "../components/marketing/LegalDocument";
import { PRIVACY_POLICY } from "../lib/legalCopy";
import { SEO } from "../lib/marketingCopy";
import { usePageSeo } from "../lib/seo";

export function PrivacyPage() {
  usePageSeo(useMemo(() => SEO.privacy, []));

  return (
    <MarketingPageShell>
      <LegalDocument doc={PRIVACY_POLICY} currentPath="/privacy" />
    </MarketingPageShell>
  );
}
