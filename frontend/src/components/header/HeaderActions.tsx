import { Link } from "react-router-dom";
import { Upload, HelpCircle } from "lucide-react";
import { PLAN_LABELS, type Plan, type SubscriptionPlan } from "../../lib/plans";
import { NAV } from "../../lib/marketingCopy";
import { CropsBadge } from "../CropsBadge";
import { UserMenu } from "../UserMenu";
import {
  headerGhostBtn,
  headerIconBtn,
  headerPrimaryBtn,
  mobileActionGrid,
  mobileOutlineBtn,
  mobilePrimaryBtn,
} from "./styles";
import { MobileMenuSection } from "./SiteNavMenu";
import { AppNavLinks } from "./AppNavLinks";
import { useCloseHeaderMenu } from "./HeaderMenuContext";

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

function upgradeCTA(plan: Plan | null, isAdmin: boolean) {
  const upgradeLabel =
    !isAdmin && plan === "free"
      ? "Upgrade"
      : !isAdmin && plan === "unlimited"
        ? "Go Pro"
        : !isAdmin && plan === "pro"
          ? "Get Enterprise"
          : null;

  const upgradeTarget: SubscriptionPlan | null =
    plan === "free"
      ? "unlimited"
      : plan === "unlimited"
        ? "pro"
        : plan === "pro"
          ? "api"
          : null;

  return { upgradeLabel, upgradeTarget };
}

function useMenuNavigate() {
  const closeMenu = useCloseHeaderMenu();
  return () => closeMenu?.();
}

export function HelpHeaderButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={headerIconBtn}
      title="How to use GemCheck"
      aria-label="Help"
    >
      <HelpCircle className="w-4 h-4" />
      <span className="hidden sm:inline">Help</span>
    </button>
  );
}

export function AppHeaderActions({ onOpenHelp }: { onOpenHelp: () => void }) {
  return (
    <>
      <CropsBadge />
      <HelpHeaderButton onClick={onOpenHelp} />
      <UserMenu />
    </>
  );
}

/** Compact actions shown beside the menu button on small screens. */
export function AppHeaderMobileActions({ onOpenHelp }: { onOpenHelp: () => void }) {
  return (
    <>
      <CropsBadge />
      <HelpHeaderButton onClick={onOpenHelp} />
      <UserMenu />
    </>
  );
}

export function LoggedInMarketingActions({
  plan,
  isAdmin = false,
  onUpgrade,
}: {
  plan: Plan | null;
  isAdmin?: boolean;
  onUpgrade: (plan: SubscriptionPlan) => void;
}) {
  const { upgradeLabel, upgradeTarget } = upgradeCTA(plan, isAdmin);

  return (
    <>
      {isAdmin ? null : plan ? <PlanBadge plan={plan} /> : null}
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
  );
}

export function GuestMobileMenuActions() {
  const onNavigate = useMenuNavigate();

  return (
    <MobileMenuSection>
      <div className={mobileActionGrid}>
        <Link to="/login" className={mobileOutlineBtn} onClick={onNavigate}>
          {NAV.signIn}
        </Link>
        <Link to="/register" className={`${mobilePrimaryBtn} text-xs leading-snug`} onClick={onNavigate}>
          {NAV.checkCardFree}
        </Link>
      </div>
    </MobileMenuSection>
  );
}

export function LoggedInMarketingMobileMenuActions() {
  const onNavigate = useMenuNavigate();

  return (
    <MobileMenuSection>
      <div className={mobileActionGrid}>
        <Link to="/account" className={mobileOutlineBtn} onClick={onNavigate}>
          Account
        </Link>
        <Link to="/crop" className={mobilePrimaryBtn} onClick={onNavigate}>
          <Upload className="w-4 h-4" />
          Open app
        </Link>
      </div>
    </MobileMenuSection>
  );
}

export function AppMobileMenuActions() {
  const onNavigate = useMenuNavigate();

  return (
    <MobileMenuSection>
      <AppNavLinks stacked onNavigate={onNavigate} />
      <div className={`mt-3 ${mobileActionGrid}`}>
        <Link to="/account" className={mobileOutlineBtn} onClick={onNavigate}>
          Account
        </Link>
        <Link to="/history" className={mobileOutlineBtn} onClick={onNavigate}>
          History
        </Link>
      </div>
    </MobileMenuSection>
  );
}
