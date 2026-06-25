import { Link, NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import {
  HEADER_NAV_LINKS,
  HEADER_RESOURCE_LINKS,
  NAV_MENU_GROUPS,
  type SiteNavItem,
} from "../../lib/siteNav";
import { headerGhostBtn, headerPrimaryBtn, mobileMenuSection } from "./styles";
import { NAV } from "../../lib/marketingCopy";

type Props = {
  links?: readonly SiteNavItem[];
  resourceLinks?: readonly SiteNavItem[];
  onNavigate?: () => void;
  highlightActive?: boolean;
  variant?: "sheet" | "dropdown";
};

function NavItem({
  item,
  onNavigate,
  highlightActive,
  className,
  activeClassName,
}: {
  item: SiteNavItem;
  onNavigate?: () => void;
  highlightActive?: boolean;
  className: string;
  activeClassName: string;
}) {
  if (item.external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        onClick={onNavigate}
      >
        {item.label}
      </a>
    );
  }

  if (highlightActive) {
    return (
      <NavLink
        to={item.href}
        end={item.href === "/"}
        onClick={onNavigate}
        className={({ isActive }) => (isActive ? activeClassName : className)}
      >
        {item.label}
      </NavLink>
    );
  }

  return (
    <Link to={item.href} className={className} onClick={onNavigate}>
      {item.label}
    </Link>
  );
}

export function SiteNavMenu({
  links = HEADER_NAV_LINKS,
  resourceLinks = HEADER_RESOURCE_LINKS,
  onNavigate,
  highlightActive = false,
  variant = "sheet",
}: Props) {
  const sheetLink =
    "px-3 py-2.5 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-overlay transition-colors";
  const sheetActive =
    "px-3 py-2.5 rounded-lg text-sm text-text-primary font-medium bg-surface-overlay/80";

  const dropdownLink =
    "rounded-md px-2 py-1.5 text-[13px] text-text-secondary hover:text-text-primary hover:bg-surface-overlay/70 transition-colors";
  const dropdownActive =
    "rounded-md px-2 py-1.5 text-[13px] font-medium text-text-primary bg-surface-overlay/80";

  if (variant === "dropdown") {
    return (
      <div className="p-2">
        {NAV_MENU_GROUPS.map((group, index) => (
          <div key={group.label} className={index > 0 ? "mt-2 pt-2 border-t border-border-subtle" : ""}>
            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              {group.label}
            </p>
            <div className="grid grid-cols-2 gap-0.5">
              {group.links.map((item) => (
                <NavItem
                  key={item.href}
                  item={item}
                  onNavigate={onNavigate}
                  highlightActive={highlightActive}
                  className={dropdownLink}
                  activeClassName={dropdownActive}
                />
              ))}
            </div>
          </div>
        ))}

        <div className="mt-2 pt-2 border-t border-border-subtle">
          <Link
            to="/docs"
            onClick={onNavigate}
            className={`${dropdownLink} flex items-center justify-between gap-2`}
          >
            <span>API docs</span>
            <ChevronRight className="w-3.5 h-3.5 shrink-0 text-text-muted" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {links.map((item) => (
        <NavItem
          key={item.href}
          item={item}
          onNavigate={onNavigate}
          highlightActive={highlightActive}
          className={sheetLink}
          activeClassName={sheetActive}
        />
      ))}
      {resourceLinks.map((item) => (
        <NavItem
          key={item.href}
          item={item}
          onNavigate={onNavigate}
          highlightActive={highlightActive}
          className={sheetLink}
          activeClassName={sheetActive}
        />
      ))}
    </div>
  );
}

export function GuestHeaderActions({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <Link to="/login" className={headerGhostBtn} onClick={onNavigate}>
        {NAV.signIn}
      </Link>
      <Link to="/register" className={headerPrimaryBtn} onClick={onNavigate}>
        {NAV.checkCardFree}
      </Link>
    </>
  );
}

export function MobileMenuSection({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={className ?? mobileMenuSection}>{children}</div>;
}
