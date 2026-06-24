import { Link } from "react-router-dom";
import { Upload } from "lucide-react";
import { MarketingSiteHeader } from "../marketing/MarketingSiteHeader";
import { GuestHeaderActions, SiteNavMenuActions } from "../marketing/SiteNavMenu";
import { headerGhostBtn, headerPrimaryBtn } from "../marketing/headerCtaStyles";
import { NAV } from "../../lib/marketingCopy";
import { PLAN_LABELS, type Plan, type SubscriptionPlan } from "../../lib/plans";
import { AdminBadge } from "../../lib/adminAccess";

function PlanBadge({ plan }: { plan: Plan }) {
  return (
    <span className="rounded-full border border-border-subtle bg-surface-overlay/60 px-2.5 py-1 text-[11px] font-medium text-text-secondary">
      {PLAN_LABELS[plan]}
    </span>
  );
}

function UpgradeLink({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm font-semibold text-accent hover:text-accent-hover transition-colors"
    >
      {label}
    </button>
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
  const upgradeLabel =
    !isAdmin && plan === "free"
      ? "Upgrade"
      : !isAdmin && plan === "unlimited"
        ? "Go Pro"
        : !isAdmin && plan === "pro"
          ? "Get Enterprise"
          : null;

  const upgradeTarget: SubscriptionPlan | null =
    plan === "free" ? "unlimited" : plan === "unlimited" ? "pro" : plan === "pro" ? "api" : null;

  return (
    <MarketingSiteHeader
      homeHref="#top"
      sticky
      logoClassName="h-10 sm:h-11"
      actions={
        loggedIn ? (
          <>
            {isAdmin ? <AdminBadge /> : plan ? <PlanBadge plan={plan} /> : null}
            {upgradeLabel && upgradeTarget ? (
              <UpgradeLink label={upgradeLabel} onClick={() => onUpgrade(upgradeTarget)} />
            ) : null}
            <Link to="/account" className={headerGhostBtn}>
              Account
            </Link>
            <Link to="/crop" className={headerPrimaryBtn}>
              <Upload className="w-4 h-4" />
              Open app
            </Link>
          </>
        ) : (
          <GuestHeaderActions />
        )
      }
      mobileMenuActions={
        loggedIn ? (
          <SiteNavMenuActions className="mt-3 pt-3 border-t border-border-subtle md:hidden">
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
          </SiteNavMenuActions>
        ) : (
          <SiteNavMenuActions className="mt-3 pt-3 border-t border-border-subtle md:hidden">
            <div className="grid grid-cols-2 gap-2">
              <Link
                to="/login"
                className="rounded-xl border border-border-strong px-4 py-2.5 text-sm font-medium text-center text-text-primary"
              >
                {NAV.signIn}
              </Link>
              <Link to="/register" className={`${headerPrimaryBtn} w-full text-center`}>
                {NAV.checkCardFree}
              </Link>
            </div>
          </SiteNavMenuActions>
        )
      }
    />
  );
}
