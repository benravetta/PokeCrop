import { Link, NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import {
  HEADER_NAV_LINKS,
  HEADER_RESOURCE_LINKS,
  type SiteNavItem,
} from "../../lib/siteNav";

type Props = {
  links?: readonly SiteNavItem[];
  resourceLinks?: readonly SiteNavItem[];
  onNavigate?: () => void;
  highlightActive?: boolean;
  linkClassName?: string;
  activeLinkClassName?: string;
};

function NavItem({
  item,
  onNavigate,
  highlightActive,
  linkClassName,
  activeLinkClassName,
}: {
  item: SiteNavItem;
  onNavigate?: () => void;
  highlightActive?: boolean;
  linkClassName: string;
  activeLinkClassName: string;
}) {
  if (item.external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClassName}
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
        className={({ isActive }) => (isActive ? activeLinkClassName : linkClassName)}
      >
        {item.label}
      </NavLink>
    );
  }

  return (
    <Link to={item.href} className={linkClassName} onClick={onNavigate}>
      {item.label}
    </Link>
  );
}

export function SiteNavMenu({
  links = HEADER_NAV_LINKS,
  resourceLinks = HEADER_RESOURCE_LINKS,
  onNavigate,
  highlightActive = false,
  linkClassName = "px-3 py-2.5 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-overlay transition-colors",
  activeLinkClassName = "px-3 py-2.5 rounded-lg text-sm text-text-primary font-medium bg-surface-overlay/80",
}: Props) {
  return (
    <div className="flex flex-col gap-1">
      {links.map((item) => (
        <NavItem
          key={item.href}
          item={item}
          onNavigate={onNavigate}
          highlightActive={highlightActive}
          linkClassName={linkClassName}
          activeLinkClassName={activeLinkClassName}
        />
      ))}
      {resourceLinks.map((item) => (
        <NavItem
          key={item.href}
          item={item}
          onNavigate={onNavigate}
          highlightActive={highlightActive}
          linkClassName={linkClassName}
          activeLinkClassName={activeLinkClassName}
        />
      ))}
    </div>
  );
}

export function SiteNavMenuActions({ children }: { children: ReactNode }) {
  return <div className="mt-3 pt-3 border-t border-border-subtle">{children}</div>;
}
