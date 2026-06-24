import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { SiteFooter } from "../landing/FooterSections";
import { Wordmark } from "../landing/shared";

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
      <header className="border-b border-border-subtle bg-surface/90 backdrop-blur-xl">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <Link to="/" className="shrink-0">
            <Wordmark className="h-8" />
          </Link>
          <nav className="hidden sm:flex items-center gap-4 text-sm">
            <Link to="/how-it-works" className="text-text-secondary hover:text-text-primary">
              How it works
            </Link>
            <Link to="/pricing" className="text-text-secondary hover:text-text-primary">
              Pricing
            </Link>
            <Link to="/faq" className="text-text-secondary hover:text-text-primary">
              FAQ
            </Link>
            <Link to="/trade" className="text-text-secondary hover:text-text-primary">
              Trade
            </Link>
            <Link to="/about" className="text-text-secondary hover:text-text-primary">
              About
            </Link>
            <Link to="/contact" className="text-text-secondary hover:text-text-primary">
              Contact
            </Link>
          </nav>
        </div>
      </header>

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
