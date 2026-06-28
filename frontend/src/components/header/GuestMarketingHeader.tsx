import { SiteHeader } from "./SiteHeader";
import { GuestHeaderActions } from "./SiteNavMenu";
import { GuestMobileMenuActions } from "./HeaderActions";

export function GuestMarketingHeader() {
  return (
    <SiteHeader
      sticky
      highlightActive
      actions={<GuestHeaderActions />}
      mobileMenuActions={<GuestMobileMenuActions />}
    />
  );
}
