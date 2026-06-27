import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { SiteFooter } from "../../components/landing/FooterSections";
import { GuestMarketingHeader } from "../../components/header/GuestMarketingHeader";
import { Wordmark } from "../../components/landing/shared";

export function PublicProfileShell({
  children,
  showFooter = true,
}: {
  children: ReactNode;
  showFooter?: boolean;
}) {
  return (
    <div className="min-h-[100dvh] bg-surface text-text-primary flex flex-col">
      <GuestMarketingHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">{children}</div>
      </main>
      {showFooter ? (
        <SiteFooter />
      ) : (
        <footer className="border-t border-border-subtle py-6">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6">
            <Link to="/" className="opacity-80 transition hover:opacity-100">
              <Wordmark />
            </Link>
            <Link to="/" className="text-sm text-text-muted hover:text-text-primary">
              GemCheck home
            </Link>
          </div>
        </footer>
      )}
    </div>
  );
}
