import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Wordmark } from "../landing/shared";
import { SiteNavMenu } from "./SiteNavMenu";
import { HeaderMenuProvider } from "./HeaderMenuContext";

export type SiteHeaderProps = {
  homeHref?: string;
  highlightActive?: boolean;
  sticky?: boolean;
  logoClassName?: string;
  /** Centre column (e.g. Crop / Grade) — visible from md up. */
  centerNav?: ReactNode;
  /** Desktop actions — visible from md up. */
  actions?: ReactNode;
  /** Compact actions beside the menu button on mobile (e.g. Help + account). */
  mobileActions?: ReactNode;
  /** Extra rows at the bottom of the mobile menu sheet only. */
  mobileMenuActions?: ReactNode;
};

export function SiteHeader({
  homeHref = "/",
  highlightActive = false,
  sticky = false,
  logoClassName = "header-logo",
  centerNav,
  actions,
  mobileActions,
  mobileMenuActions,
}: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const isMobileSheet = () => window.innerWidth < 768;
    if (!isMobileSheet()) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);
  const homeIsAnchor = homeHref.startsWith("#");

  return (
    <header
      className={`z-40 transition-all duration-300 safe-top ${
        sticky ? "sticky top-0" : ""
      } ${
        sticky && scrolled
          ? "bg-surface/90 backdrop-blur-xl border-b border-border-subtle shadow-lg shadow-black/10"
          : sticky
            ? "bg-transparent border-b border-transparent"
            : "bg-surface/90 backdrop-blur-xl border-b border-border-subtle"
      }`}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 sm:gap-3 page-x header-h">
        {homeIsAnchor ? (
          <a href={homeHref} className="shrink-0" onClick={closeMenu}>
            <Wordmark className={logoClassName} />
          </a>
        ) : (
          <Link to={homeHref} className="shrink-0" onClick={closeMenu}>
            <Wordmark className={logoClassName} />
          </Link>
        )}

        {centerNav ? (
          <div className="hidden md:flex flex-1 justify-center items-center min-w-0 px-2">
            {centerNav}
          </div>
        ) : null}

        <div ref={menuRef} className="relative flex items-center gap-1 sm:gap-1.5 shrink-0">
          {actions ? (
            <div className="hidden md:flex items-center gap-2 shrink-0">{actions}</div>
          ) : null}

          {mobileActions ? (
            <div className="flex shrink-0 items-center gap-1 md:hidden">{mobileActions}</div>
          ) : null}

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className={`touch-target inline-flex items-center justify-center rounded-lg transition-colors ${
              menuOpen
                ? "bg-surface-overlay text-text-primary"
                : "text-text-secondary hover:bg-surface-overlay"
            }`}
            aria-expanded={menuOpen}
            aria-controls="site-header-mobile-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {menuOpen ? (
            <>
              <button
                type="button"
                aria-label="Close menu"
                className="fixed inset-0 top-[var(--header-h)] z-30 bg-black/40 md:hidden"
                onClick={closeMenu}
              />

              <div
                id="site-header-mobile-menu"
                role="dialog"
                aria-modal="true"
                aria-label="Site menu"
                className="fixed inset-x-0 top-[var(--header-h)] z-40 max-h-[calc(100dvh-var(--header-h))] overflow-y-auto overscroll-contain border-t border-border-subtle bg-surface/98 px-4 py-4 shadow-lg shadow-black/20 backdrop-blur-xl anim-fade safe-bottom md:hidden"
              >
                <HeaderMenuProvider closeMenu={closeMenu}>
                  <SiteNavMenu highlightActive={highlightActive} onNavigate={closeMenu} variant="sheet" />
                  {mobileMenuActions}
                </HeaderMenuProvider>
              </div>

              <div className="hidden md:block absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[17.5rem] rounded-xl border border-border-subtle bg-surface/98 backdrop-blur-xl shadow-xl shadow-black/25 anim-fade">
                <SiteNavMenu
                  highlightActive={highlightActive}
                  onNavigate={closeMenu}
                  variant="dropdown"
                />
              </div>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}

/** @deprecated Use SiteHeader — kept for existing imports. */
export const MarketingSiteHeader = SiteHeader;
