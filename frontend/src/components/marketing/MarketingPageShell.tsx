import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { SiteFooter } from "../landing/FooterSections";
import { MarketingSiteHeader } from "./MarketingSiteHeader";
import { SiteNavMenuActions } from "./SiteNavMenu";

export function MarketingPageShell({
  children,
  backHref = "/",
  backLabel = "Back to home",
  wide = false,
}: {
  children: ReactNode;
  backHref?: string;
  backLabel?: string;
  wide?: boolean;
}) {
  return (
    <div className="min-h-[100dvh] bg-surface text-text-primary flex flex-col">
      <MarketingSiteHeader
        highlightActive
        menuActions={
          <SiteNavMenuActions>
            <div className="grid grid-cols-2 gap-2">
              <Link
                to="/login"
                className="rounded-xl border border-border-strong px-4 py-2.5 text-sm font-medium text-center text-text-primary"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white text-center"
              >
                Check a card
              </Link>
            </div>
          </SiteNavMenuActions>
        }
      />

      <main className="flex-1">
        <div className={`mx-auto px-4 sm:px-6 py-8 sm:py-12 ${wide ? "max-w-6xl" : "max-w-3xl"}`}>
          <Link
            to={backHref}
            className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            {backLabel}
          </Link>
          {children}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
