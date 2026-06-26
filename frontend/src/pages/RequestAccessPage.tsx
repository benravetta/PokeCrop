import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { WaitlistLanding } from "../components/waitlist/WaitlistLanding";
import { MarketingPageShell } from "../components/marketing/MarketingPageShell";
import { GuestPrimaryCtaLink } from "../components/marketing/GuestPrimaryCtaLink";
import { getInviteRequestsEnabled } from "../lib/api";
import { SEO } from "../lib/marketingCopy";
import { usePageSeo } from "../lib/seo";

export function RequestAccessPage() {
  usePageSeo(useMemo(() => SEO.requestAccess, []));
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    getInviteRequestsEnabled()
      .then((r) => setEnabled(r.enabled))
      .catch(() => setLoadFailed(true));
  }, []);

  if (enabled === true) {
    return <WaitlistLanding />;
  }

  if (loadFailed) {
    return (
      <MarketingPageShell>
        <div className="max-w-lg">
          <h1 className="text-3xl font-semibold tracking-tight">Could not load page</h1>
          <p className="mt-4 text-base text-text-secondary leading-relaxed">
            Try again in a moment or go to{" "}
            <GuestPrimaryCtaLink className="text-accent hover:underline" />.
          </p>
        </div>
      </MarketingPageShell>
    );
  }

  if (enabled === null) {
    return (
      <MarketingPageShell>
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 text-accent animate-spin" />
        </div>
      </MarketingPageShell>
    );
  }

  return (
    <MarketingPageShell>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent mb-3">
        Registration open
      </p>
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-4 text-base text-text-secondary leading-relaxed">
        GemCheck is not in invite-only mode right now. You can register directly.
      </p>
      <GuestPrimaryCtaLink
        registerLabel="Create account"
        className="inline-flex mt-6 px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover"
      />
      <p className="mt-4 text-sm text-text-muted">
        Already have an account?{" "}
        <Link to="/login" className="text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </MarketingPageShell>
  );
}
