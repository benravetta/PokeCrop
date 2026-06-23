import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ExternalLink, KeyRound, Terminal } from "lucide-react";

// Public API documentation. Renders the Scalar API reference against the live
// OpenAPI spec at /v1/openapi.json. The CDN script is pinned to an exact,
// immutable version and verified with Subresource Integrity so a CDN or package
// compromise cannot execute arbitrary JS in our origin.
const SCALAR_VERSION = "1.60.0";
const SCALAR_SRC = `https://cdn.jsdelivr.net/npm/@scalar/api-reference@${SCALAR_VERSION}`;
const SCALAR_SRI =
  "sha384-4BdmZQQTc462+ocGPo+GP3Hi/eQjMQTmNkSU9J5w3FD6hGUEmU2PqNRnbklONt4R";
const SPEC_URL = "/v1/openapi.json";
const BASE_URL = "https://gemcheck.co.uk/v1";

type ScalarGlobal = {
  createApiReference: (
    el: Element | string,
    config: Record<string, unknown>
  ) => void;
};

const scalarConfig = {
  url: SPEC_URL,
  darkMode: true,
  layout: "modern",
  theme: "purple",
  searchHotKey: "k",
  hideDownloadButton: false,
  hideModels: false,
  defaultHttpClient: { targetKey: "curl", clientKey: "curl" },
  metaData: {
    title: "GemCheck API",
    description:
      "Crop trading cards and run AI pre-grades — same engine as the web app. Requires an API plan.",
  },
  customCss: `
    .scalar-app { --scalar-color-accent: #7c6cf6; }
    .introduction-description { max-width: 72ch; }
  `,
};

export function DocsPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = "GemCheck API — Documentation";
    const container = containerRef.current;
    if (!container) return;

    const mount = () => {
      const scalar = (window as unknown as { Scalar?: ScalarGlobal }).Scalar;
      if (scalar) scalar.createApiReference(container, scalarConfig);
    };

    // Reuse the loader if the script is already present (e.g. client-side nav).
    let loader = document.querySelector<HTMLScriptElement>(
      `script[src="${SCALAR_SRC}"]`
    );
    if ((window as unknown as { Scalar?: ScalarGlobal }).Scalar) {
      mount();
    } else if (loader) {
      loader.addEventListener("load", mount, { once: true });
    } else {
      loader = document.createElement("script");
      loader.src = SCALAR_SRC;
      loader.async = true;
      loader.integrity = SCALAR_SRI;
      loader.crossOrigin = "anonymous";
      loader.addEventListener("load", mount, { once: true });
      document.body.appendChild(loader);
    }

    return () => {
      if (container) container.innerHTML = "";
    };
  }, []);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-surface">
      <header className="flex items-center justify-between px-5 h-14 border-b border-border-subtle shrink-0">
        <Link to="/" className="flex items-center gap-2.5">
          <img
            src="/gemcheck-logo.png"
            alt="GemCheck — by Looky"
            className="h-8 w-auto select-none"
            draggable={false}
          />
          <span className="text-[13px] font-medium text-text-muted uppercase tracking-wide">
            API
          </span>
        </Link>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-[13px] text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to app
        </Link>
      </header>

      <section className="border-b border-border-subtle bg-surface-raised/50 shrink-0">
        <div className="mx-auto max-w-6xl px-5 py-8 sm:py-10">
          <p className="text-xs font-medium uppercase tracking-wider text-accent mb-2">
            REST API · OpenAPI 1.2.0
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold text-text-primary tracking-tight">
            GemCheck API reference
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-text-secondary">
            Detect and extract cards from photos, run AI pre-grades with per-company estimates,
            and download the same PDF report as the web app. Requires the{" "}
            <Link to="/pricing" className="text-accent hover:underline">
              API plan
            </Link>{" "}
            (£19.99/mo) — create keys on{" "}
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
              Subscribe to API plan
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
                60 crops/min · 20 grades/day · PDF via <code>format=pdf</code>
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
        </div>
      </section>

      <div ref={containerRef} className="flex-1 min-h-0" />
      <noscript>
        <div className="p-6 text-sm text-text-secondary">
          Enable JavaScript to view the interactive docs, or fetch the raw spec at{" "}
          <code>/v1/openapi.json</code>.
        </div>
      </noscript>
    </div>
  );
}
