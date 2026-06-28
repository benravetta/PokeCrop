import { useMemo, useState } from "react";
import { Link, Outlet, useOutletContext } from "react-router-dom";
import { HelpDrawer } from "./HelpDrawer";
import { AppSiteHeader } from "./AppSiteHeader";
import { FooterLegalBlock } from "./pageLayout/FooterLegalBlock";
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

      <footer className="border-t border-border-subtle bg-surface/90 footer-py-compact">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-2 page-x sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <p className="text-center text-xs text-text-muted sm:text-left">
            A{" "}
            <a
              href="https://getlooky.uk"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-secondary transition-colors hover:text-text-primary"
            >
              Looky Collectibles
            </a>{" "}
            Tool
          </p>
          <FooterLegalBlock className="text-center sm:text-left">
            GemCheck provides pre-grade estimates only. Final grades are set by the grading company.
          </FooterLegalBlock>
          <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-end">
            <Link
              to="/docs"
              className="text-xs text-text-muted transition-colors hover:text-text-primary"
            >
              API docs
            </Link>
            <span className="hidden text-xs text-text-muted sm:inline">
              Built with ❤️ in the English Lake District
            </span>
          </div>
        </div>
      </footer>

      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
