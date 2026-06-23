import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

// Public API documentation. Renders the Scalar API reference against the live
// OpenAPI spec at /v1/openapi.json. The CDN script is pinned to an exact,
// immutable version and verified with Subresource Integrity so a CDN or package
// compromise cannot execute arbitrary JS in our origin.
const SCALAR_VERSION = "1.60.0";
const SCALAR_SRC = `https://cdn.jsdelivr.net/npm/@scalar/api-reference@${SCALAR_VERSION}`;
const SCALAR_SRI =
  "sha384-4BdmZQQTc462+ocGPo+GP3Hi/eQjMQTmNkSU9J5w3FD6hGUEmU2PqNRnbklONt4R";
const SPEC_URL = "/v1/openapi.json";

type ScalarGlobal = {
  createApiReference: (
    el: Element | string,
    config: Record<string, unknown>
  ) => void;
};

export function DocsPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = "GemCheck API — Documentation";
    const container = containerRef.current;
    if (!container) return;

    const config = { url: SPEC_URL, darkMode: true, hideDownloadButton: false };
    const mount = () => {
      const scalar = (window as unknown as { Scalar?: ScalarGlobal }).Scalar;
      if (scalar) scalar.createApiReference(container, config);
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
      <div ref={containerRef} className="flex-1 min-h-0" />
      <noscript>
        <div className="p-6 text-sm text-text-secondary">
          Enable JavaScript to view the interactive docs, or fetch the raw spec
          at <code>/v1/openapi.json</code>.
        </div>
      </noscript>
    </div>
  );
}
