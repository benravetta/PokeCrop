import { Link, NavLink } from "react-router-dom";
import { HelpCircle } from "lucide-react";
import { MarketingSiteHeader } from "./marketing/MarketingSiteHeader";
import { SiteNavMenuActions } from "./marketing/SiteNavMenu";
import { UserMenu } from "./UserMenu";
import { CropsBadge } from "./CropsBadge";

const appNavLink =
  "px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors";
const appNavActive =
  "bg-surface-overlay text-text-primary";
const appNavIdle =
  "text-text-secondary hover:text-text-primary hover:bg-surface-overlay/60";

function AppNavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex items-center gap-1">
      <NavLink
        to="/crop"
        end
        onClick={onNavigate}
        className={({ isActive }) =>
          `${appNavLink} ${isActive ? appNavActive : appNavIdle}`
        }
      >
        Crop &amp; centring
      </NavLink>
      <NavLink
        to="/grade"
        onClick={onNavigate}
        className={({ isActive }) =>
          `${appNavLink} ${isActive ? appNavActive : appNavIdle}`
        }
      >
        Grade
      </NavLink>
    </nav>
  );
}

type AppSiteHeaderProps = {
  onOpenHelp: () => void;
};

export function AppSiteHeader({ onOpenHelp }: AppSiteHeaderProps) {
  return (
    <MarketingSiteHeader
      homeHref="/crop"
      highlightActive
      centerNav={<AppNavLinks />}
      actions={
        <>
          <CropsBadge />
          <button
            type="button"
            onClick={onOpenHelp}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-text-secondary hover:text-text-primary hover:bg-surface-overlay transition-colors"
            title="How to use GemCheck"
          >
            <HelpCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Help</span>
          </button>
          <UserMenu />
        </>
      }
      mobileMenuActions={
        <SiteNavMenuActions className="mt-3 pt-3 border-t border-border-subtle md:hidden">
          <AppNavLinks />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link
              to="/account"
              className="rounded-xl border border-border-strong px-4 py-2.5 text-sm font-medium text-center text-text-primary"
            >
              Account
            </Link>
            <Link
              to="/history"
              className="rounded-xl border border-border-strong px-4 py-2.5 text-sm font-medium text-center text-text-primary"
            >
              History
            </Link>
          </div>
        </SiteNavMenuActions>
      }
    />
  );
}
