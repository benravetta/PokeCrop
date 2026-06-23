import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Menu, Upload, X } from "lucide-react";
import { NAV_LINKS } from "./data";
import { Wordmark } from "./shared";
import { PLAN_LABELS, type Plan, type SubscriptionPlan } from "../../lib/plans";

function PlanBadge({ plan }: { plan: Plan }) {
  return (
    <span className="rounded-full border border-border-subtle bg-surface-overlay/60 px-2.5 py-1 text-[11px] font-medium text-text-secondary">
      {PLAN_LABELS[plan]}
    </span>
  );
}

export function TopNav({
  loggedIn,
  plan,
  onUpgrade,
}: {
  loggedIn: boolean;
  plan: Plan | null;
  onUpgrade: (plan: SubscriptionPlan) => void;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-surface/90 backdrop-blur-xl border-b border-border-subtle shadow-lg shadow-black/10"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <a href="#top" className="shrink-0">
          <Wordmark className="h-10 sm:h-11" />
        </a>

        <nav className="hidden lg:flex items-center gap-0.5">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="px-3 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-overlay/60 transition-colors"
            >
              {l.label}
            </a>
          ))}
          <Link
            to="/docs"
            className="px-3 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-overlay/60 transition-colors"
          >
            API
          </Link>
        </nav>

        <div className="hidden lg:flex items-center gap-2">
          {loggedIn ? (
            <>
              {plan && <PlanBadge plan={plan} />}
              {plan === "free" && (
                <button
                  onClick={() => onUpgrade("unlimited")}
                  className="px-3 py-2 rounded-lg text-sm font-semibold text-accent hover:bg-accent/10 transition-colors"
                >
                  Upgrade
                </button>
              )}
              {plan === "unlimited" && (
                <button
                  onClick={() => onUpgrade("pro")}
                  className="px-3 py-2 rounded-lg text-sm font-semibold text-accent hover:bg-accent/10 transition-colors"
                >
                  Go Pro
                </button>
              )}
              {plan === "pro" && (
                <button
                  onClick={() => onUpgrade("api")}
                  className="px-3 py-2 rounded-lg text-sm font-semibold text-accent hover:bg-accent/10 transition-colors"
                >
                  Get Enterprise
                </button>
              )}
              <Link
                to="/crop"
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20"
              >
                <Upload className="w-4 h-4" />
                Open app
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="px-3 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20"
              >
                Try it free
              </Link>
            </>
          )}
        </div>

        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg text-text-secondary hover:bg-surface-overlay"
          aria-label="Toggle menu"
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {menuOpen && (
        <div className="lg:hidden border-t border-border-subtle bg-surface/95 backdrop-blur-xl px-4 py-3 anim-fade">
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="px-3 py-2.5 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-overlay transition-colors"
              >
                {l.label}
              </a>
            ))}
            <Link
              to="/docs"
              onClick={() => setMenuOpen(false)}
              className="px-3 py-2.5 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-overlay transition-colors"
            >
              API
            </Link>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {loggedIn ? (
                <>
                  <Link
                    to="/account"
                    onClick={() => setMenuOpen(false)}
                    className="rounded-xl border border-border-strong px-4 py-2.5 text-sm font-medium text-center text-text-primary"
                  >
                    Account
                  </Link>
                  <Link
                    to="/crop"
                    onClick={() => setMenuOpen(false)}
                    className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white text-center"
                  >
                    Open app
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setMenuOpen(false)}
                    className="rounded-xl border border-border-strong px-4 py-2.5 text-sm font-medium text-center text-text-primary"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMenuOpen(false)}
                    className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white text-center"
                  >
                    Try it free
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
