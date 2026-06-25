import { useMemo, useState } from "react";
import { Link, Outlet, useOutletContext } from "react-router-dom";
import { HelpDrawer } from "./HelpDrawer";
import { AppSiteHeader } from "./AppSiteHeader";
import { SEO } from "../lib/marketingCopy";
import { usePageSeo } from "../lib/seo";

export interface LayoutContext {
  openHelp: () => void;
}

export function useLayout(): LayoutContext {
  return useOutletContext<LayoutContext>();
}

export function Layout() {
  const [helpOpen, setHelpOpen] = useState(false);

  usePageSeo(useMemo(() => SEO.private, []));

  return (
    <div className="h-[100dvh] overflow-hidden bg-surface flex flex-col">
      <AppSiteHeader onOpenHelp={() => setHelpOpen(true)} />

      <main className="flex-1 flex flex-col min-h-0">
        <Outlet context={{ openHelp: () => setHelpOpen(true) } satisfies LayoutContext} />
      </main>

      <footer className="border-t border-border-subtle bg-surface/90">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-2.5 sm:py-3 flex flex-col sm:flex-row items-center justify-between gap-1">
          <p className="text-[11px] text-text-muted">
            A{" "}
            <a
              href="https://getlooky.uk"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              Looky Collectibles
            </a>{" "}
            Tool
          </p>
          <p className="text-[11px] text-text-muted text-center">
            GemCheck provides pre-grade estimates only. Final grades are set by the grading company.
          </p>
          <div className="flex items-center gap-3">
            <Link
              to="/docs"
              className="text-[11px] text-text-muted hover:text-text-primary transition-colors"
            >
              API docs
            </Link>
            <span className="hidden sm:block text-[11px] text-text-muted">
              Built with ❤️ in the English Lake District
            </span>
          </div>
        </div>
      </footer>

      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
