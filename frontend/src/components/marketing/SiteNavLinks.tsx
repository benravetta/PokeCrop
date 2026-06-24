import { Link, NavLink } from "react-router-dom";
import type { SiteNavItem } from "../../lib/siteNav";

type Props = {
  links: readonly SiteNavItem[];
  className?: string;
  linkClassName?: string;
  activeLinkClassName?: string;
  onNavigate?: () => void;
  /** Highlight the link matching the current route (marketing subpages). */
  highlightActive?: boolean;
};

export function SiteNavLinks({
  links,
  className,
  linkClassName = "text-text-secondary hover:text-text-primary transition-colors",
  activeLinkClassName = "text-text-primary",
  onNavigate,
  highlightActive = false,
}: Props) {
  return (
    <>
      {links.map((item) => {
        if (item.external) {
          return (
            <a
              key={item.href}
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
              key={item.href}
              to={item.href}
              end={item.href === "/"}
              onClick={onNavigate}
              className={({ isActive }) =>
                isActive ? activeLinkClassName : linkClassName
              }
            >
              {item.label}
            </NavLink>
          );
        }

        return (
          <Link key={item.href} to={item.href} className={linkClassName} onClick={onNavigate}>
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
