import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { SiteFooter } from "../landing/FooterSections";
import { GuestMarketingHeader } from "../header/GuestMarketingHeader";
import { PageContainer } from "../pageLayout";

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
        <PageContainer width={wide ? "wide" : "marketing"}>
          <Link
            to={backHref}
            className="mb-8 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
          {children}
        </PageContainer>
      </main>

      <SiteFooter />
    </div>
  );
}
