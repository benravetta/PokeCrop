import { useMemo } from "react";
import { MarketingPageShell } from "../components/marketing/MarketingPageShell";
import { LegalDocument } from "../components/marketing/LegalDocument";
import { REFUND_POLICY } from "../lib/legalCopy";
import { SEO } from "../lib/marketingCopy";
import { usePageSeo } from "../lib/seo";

export function RefundPage() {
  usePageSeo(useMemo(() => SEO.refund, []));

  return (
    <MarketingPageShell>
      <LegalDocument doc={REFUND_POLICY} currentPath="/refund" />
    </MarketingPageShell>
  );
}
