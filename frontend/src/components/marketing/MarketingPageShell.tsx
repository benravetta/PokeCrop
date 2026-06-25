import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { SiteFooter } from "../landing/FooterSections";
import { GuestMarketingHeader } from "../header/GuestMarketingHeader";

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
      <GuestMarketingHeader />

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
