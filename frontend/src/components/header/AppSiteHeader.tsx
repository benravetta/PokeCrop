import { SiteHeader } from "./SiteHeader";
import { AppNavLinks } from "./AppNavLinks";
import {
  AppHeaderActions,
  AppHeaderMobileActions,
  AppMobileMenuActions,
} from "./HeaderActions";

type AppSiteHeaderProps = {
  onOpenHelp: () => void;
};

export function AppSiteHeader({ onOpenHelp }: AppSiteHeaderProps) {
  return (
    <SiteHeader
      homeHref="/crop"
      highlightActive
      centerNav={<AppNavLinks />}
      actions={<AppHeaderActions onOpenHelp={onOpenHelp} />}
      mobileActions={<AppHeaderMobileActions onOpenHelp={onOpenHelp} />}
      mobileMenuActions={<AppMobileMenuActions />}
    />
  );
}
