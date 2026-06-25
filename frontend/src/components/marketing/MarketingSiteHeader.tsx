import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Wordmark, LOGO_CLASS } from "../landing/shared";
import { SiteNavMenu } from "./SiteNavMenu";

type Props = {
  homeHref?: string;
  highlightActive?: boolean;
  sticky?: boolean;
  logoClassName?: string;
  /** Optional centre column (e.g. app tool nav) — visible from md up. */
  centerNav?: ReactNode;
  /** Always visible from md breakpoint up (CTAs, account actions). */
  actions?: ReactNode;
  /** Extra rows at the bottom of the mobile menu sheet only. */
  mobileMenuActions?: ReactNode;
};

export function MarketingSiteHeader({
  homeHref = "/",
  highlightActive = false,
  sticky = false,
  logoClassName = LOGO_CLASS,
  centerNav,
  actions,
  mobileMenuActions,
}: Props) {
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
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
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
          <div className="hidden md:flex flex-1 justify-center items-center min-w-0 px-2">{centerNav}</div>
        ) : null}

        <div ref={menuRef} className="relative flex items-center gap-1.5 sm:gap-2 shrink-0">
          {actions ? (
            <div className="hidden md:flex items-center gap-2 shrink-0">{actions}</div>
          ) : null}

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className={`inline-flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
              menuOpen
                ? "bg-surface-overlay text-text-primary"
                : "text-text-secondary hover:bg-surface-overlay"
            }`}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {menuOpen ? (
            <>
              {/* Mobile: full-width sheet */}
              <div className="md:hidden fixed inset-x-0 top-14 sm:top-16 z-40 border-t border-border-subtle bg-surface/98 backdrop-blur-xl px-4 py-3 shadow-lg shadow-black/20 anim-fade max-h-[calc(100dvh-3.5rem)] overflow-y-auto">
                <SiteNavMenu highlightActive={highlightActive} onNavigate={closeMenu} variant="sheet" />
                {mobileMenuActions}
              </div>

              {/* Desktop / iPad: compact popover */}
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
