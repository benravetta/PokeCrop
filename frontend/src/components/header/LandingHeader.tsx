import { SiteHeader } from "./SiteHeader";
import { GuestHeaderActions } from "./SiteNavMenu";
import {
  GuestMobileMenuActions,
  LoggedInMarketingActions,
  LoggedInMarketingMobileMenuActions,
} from "./HeaderActions";
import type { Plan, SubscriptionPlan } from "../../lib/plans";

export function LandingHeader({
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
    <SiteHeader
      homeHref="#top"
      sticky
      actions={
        loggedIn ? (
          <LoggedInMarketingActions plan={plan} isAdmin={isAdmin} onUpgrade={onUpgrade} />
        ) : (
          <GuestHeaderActions />
        )
      }
      mobileMenuActions={
        loggedIn ? <LoggedInMarketingMobileMenuActions /> : <GuestMobileMenuActions />
      }
    />
  );
}

/** @deprecated Use LandingHeader — kept for existing imports. */
export const TopNav = LandingHeader;
