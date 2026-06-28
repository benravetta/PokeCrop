import { Suspense, lazy, useMemo } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, KeyRound, Terminal } from "lucide-react";
import { GuestMarketingHeader } from "../components/header/GuestMarketingHeader";
import { SiteFooter } from "../components/landing/FooterSections";
import { PageContainer } from "../components/pageLayout";
import { SEO } from "../lib/marketingCopy";
import { usePageSeo } from "../lib/seo";

const ApiReferencePanel = lazy(() =>
  import("../components/docs/ApiReferencePanel").then((m) => ({
    default: m.ApiReferencePanel,
  }))
);

const SPEC_URL = "/v1/openapi.json";
const BASE_URL = "https://gemcheck.co.uk/v1";

export function DocsPage() {
  usePageSeo(useMemo(() => SEO.docs, []));

  return (
    <div className="flex min-h-[100dvh] flex-col bg-surface">
      <GuestMarketingHeader />

      <section className="shrink-0 border-b border-border-subtle bg-surface-raised/50">
        <PageContainer className="!py-8 sm:!py-10">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-accent">
            REST API · OpenAPI 1.2.0
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
            GemCheck API reference
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-secondary sm:text-[15px]">
            Detect and extract cards from photos, run AI pre-grades with per-company estimates,
            and download the same PDF report as the web app. Requires the{" "}
            <Link to="/pricing" className="text-accent hover:underline">
              Enterprise plan
            </Link>{" "}
            (£29.99/mo) — create keys on{" "}
            <Link to="/account" className="text-accent hover:underline">
              Account
            </Link>
            .
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={SPEC_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-3.5 py-2 text-[13px] text-text-secondary hover:text-text-primary hover:border-border transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" /> openapi.json
            </a>
            <Link
              to="/account"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-3.5 py-2 text-[13px] text-text-secondary hover:text-text-primary hover:border-border transition-colors"
            >
              <KeyRound className="w-3.5 h-3.5" /> API keys
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent/15 border border-accent/30 px-3.5 py-2 text-[13px] text-accent hover:bg-accent/25 transition-colors"
            >
              Subscribe to Enterprise
            </Link>
          </div>

          <div className="mt-8 grid sm:grid-cols-3 gap-4 text-[13px]">
            <div className="rounded-xl border border-border-subtle bg-surface p-4">
              <p className="font-medium text-text-primary mb-1">Base URL</p>
              <code className="text-text-secondary break-all">{BASE_URL}</code>
            </div>
            <div className="rounded-xl border border-border-subtle bg-surface p-4">
              <p className="font-medium text-text-primary mb-1">Authentication</p>
              <code className="text-text-secondary">Authorization: Bearer pk_live_…</code>
            </div>
            <div className="rounded-xl border border-border-subtle bg-surface p-4">
              <p className="font-medium text-text-primary mb-1">Limits</p>
              <p className="text-text-secondary">
                60 crops/min · 100 grades/mo (Pro+) · PDF via <code>format=pdf</code>
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-border-subtle bg-[#0e1018] overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-2.5">
              <Terminal className="w-4 h-4 text-accent" />
              <span className="text-xs font-medium text-text-secondary">Quick start</span>
            </div>
            <pre className="overflow-x-auto px-4 py-4 text-[12.5px] leading-relaxed text-text-secondary">
              {`curl -X POST ${BASE_URL}/crop \\
  -H "Authorization: Bearer $GEMCHECK_API_KEY" \\
  -H "Accept: image/png" \\
  -F "image=@card.jpg" -o cropped.png

curl -X POST "${BASE_URL}/grade?format=pdf" \\
  -H "Authorization: Bearer $GEMCHECK_API_KEY" \\
  -H "Idempotency-Key: grade-001" \\
  -F "front=@front.jpg" -F "back=@back.jpg" \\
  -o report.pdf`}
            </pre>
          </div>
        </PageContainer>
      </section>

      <div className="min-h-[640px] flex-1 border-t border-border-subtle">
        <Suspense
          fallback={
            <PageContainer className="!py-12">
              <p className="text-sm text-text-secondary">Loading API reference…</p>
            </PageContainer>
          }
        >
          <ApiReferencePanel />
        </Suspense>
      </div>

      <SiteFooter />
    </div>
  );
}
