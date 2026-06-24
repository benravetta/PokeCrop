import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Wordmark } from "../landing/shared";
import { SiteNavMenu } from "./SiteNavMenu";

type Props = {
  homeHref?: string;
  highlightActive?: boolean;
  sticky?: boolean;
  logoClassName?: string;
  actions?: ReactNode;
  menuActions?: ReactNode;
};

export function MarketingSiteHeader({
  homeHref = "/",
  highlightActive = false,
  sticky = false,
  logoClassName = "h-8",
  actions,
  menuActions,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!sticky) return;
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [sticky]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);
  const homeIsAnchor = homeHref.startsWith("#");

  return (
    <header
      className={`z-50 transition-all duration-300 ${
        sticky ? "sticky top-0" : ""
      } ${
        sticky && scrolled
          ? "bg-surface/90 backdrop-blur-xl border-b border-border-subtle shadow-lg shadow-black/10"
          : sticky
            ? "bg-transparent border-b border-transparent"
            : "bg-surface/90 backdrop-blur-xl border-b border-border-subtle"
      }`}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-4">
        {homeIsAnchor ? (
          <a href={homeHref} className="shrink-0" onClick={closeMenu}>
            <Wordmark className={logoClassName} />
          </a>
        ) : (
          <Link to={homeHref} className="shrink-0" onClick={closeMenu}>
            <Wordmark className={logoClassName} />
          </Link>
        )}

        <div className="flex items-center gap-2">
          {actions}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="inline-flex items-center justify-center w-10 h-10 rounded-lg text-text-secondary hover:bg-surface-overlay transition-colors"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-border-subtle bg-surface/95 backdrop-blur-xl px-4 py-3 anim-fade">
          <SiteNavMenu highlightActive={highlightActive} onNavigate={closeMenu} />
          {menuActions}
        </div>
      )}
    </header>
  );
}
