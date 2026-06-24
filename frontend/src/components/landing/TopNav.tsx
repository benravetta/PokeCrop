import { Link } from "react-router-dom";
import { Upload } from "lucide-react";
import { MarketingSiteHeader } from "../marketing/MarketingSiteHeader";
import { SiteNavMenuActions } from "../marketing/SiteNavMenu";
import { PLAN_LABELS, type Plan, type SubscriptionPlan } from "../../lib/plans";
import { AdminBadge } from "../../lib/adminAccess";

function PlanBadge({ plan }: { plan: Plan }) {
  return (
    <span className="rounded-full border border-border-subtle bg-surface-overlay/60 px-2.5 py-1 text-[11px] font-medium text-text-secondary">
      {PLAN_LABELS[plan]}
    </span>
  );
}

export function TopNav({
  loggedIn,
  plan,
  isAdmin = false,
  onUpgrade,
}: {
  loggedIn: boolean;
  plan: Plan | null;
  isAdmin?: boolean;
  onUpgrade: (plan: SubscriptionPlan) => void;
}) {
  return (
    <MarketingSiteHeader
      homeHref="#top"
      sticky
      logoClassName="h-10 sm:h-11"
      menuActions={
        <SiteNavMenuActions>
          {loggedIn ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 px-3">
                {isAdmin ? <AdminBadge /> : plan ? <PlanBadge plan={plan} /> : null}
                {!isAdmin && plan === "free" && (
                  <button
                    onClick={() => onUpgrade("unlimited")}
                    className="text-sm font-semibold text-accent hover:text-accent-hover transition-colors"
                  >
                    Upgrade
                  </button>
                )}
                {!isAdmin && plan === "unlimited" && (
                  <button
                    onClick={() => onUpgrade("pro")}
                    className="text-sm font-semibold text-accent hover:text-accent-hover transition-colors"
                  >
                    Go Pro
                  </button>
                )}
                {!isAdmin && plan === "pro" && (
                  <button
                    onClick={() => onUpgrade("api")}
                    className="text-sm font-semibold text-accent hover:text-accent-hover transition-colors"
                  >
                    Get Enterprise
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  to="/account"
                  className="rounded-xl border border-border-strong px-4 py-2.5 text-sm font-medium text-center text-text-primary"
                >
                  Account
                </Link>
                <Link
                  to="/crop"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white"
                >
                  <Upload className="w-4 h-4" />
                  Open app
                </Link>
              </div>
            </div>
          ) : (
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
          )}
        </SiteNavMenuActions>
      }
    />
  );
}
