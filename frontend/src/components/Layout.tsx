import { useState } from "react";
import { Link, NavLink, Outlet, useOutletContext } from "react-router-dom";
import { HelpCircle } from "lucide-react";
import { HelpDrawer } from "./HelpDrawer";
import { UserMenu } from "./UserMenu";
import { CropsBadge } from "./CropsBadge";

export interface LayoutContext {
  openHelp: () => void;
}

export function useLayout(): LayoutContext {
  return useOutletContext<LayoutContext>();
}

export function Layout() {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div className="h-[100dvh] overflow-hidden bg-surface flex flex-col">
      <header className="border-b border-border-subtle px-4 sm:px-6 py-3 sm:py-3.5 flex items-center justify-between gap-3">
        <Link to="/crop" className="flex items-center min-w-0">
          <img
            src="/gemcheck-logo.png"
            alt="GemCheck — by Looky"
            className="h-9 sm:h-10 w-auto select-none"
            draggable={false}
          />
        </Link>

        <nav className="flex items-center gap-1">
          <NavLink
            to="/crop"
            end
            className={({ isActive }) =>
              `px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-surface-overlay text-text-primary"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-overlay/60"
              }`
            }
          >
            Crop &amp; centring
          </NavLink>
          <NavLink
            to="/grade"
            className={({ isActive }) =>
              `px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-surface-overlay text-text-primary"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-overlay/60"
              }`
            }
          >
            Grade
          </NavLink>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <CropsBadge />
          <button
            onClick={() => setHelpOpen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-text-secondary
                       hover:text-text-primary hover:bg-surface-overlay transition-colors"
            title="How to use GemCheck"
          >
            <HelpCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Help</span>
          </button>
          <UserMenu />
          <a
            href="https://getlooky.uk"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:block opacity-70 hover:opacity-100 transition-opacity"
          >
            <img src="/looky-logo.png" alt="Looky Collectibles" className="h-5" />
          </a>
        </div>
      </header>

      <main className="flex-1 flex flex-col min-h-0">
        <Outlet context={{ openHelp: () => setHelpOpen(true) } satisfies LayoutContext} />
      </main>

      <footer className="border-t border-border-subtle px-4 sm:px-6 py-2.5 sm:py-3 flex flex-col sm:flex-row items-center justify-between gap-1">
        <p className="text-[11px] text-text-muted">
          A{" "}
          <a
            href="https://getlooky.uk"
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            Looky Collectibles
          </a>{" "}
          Tool
        </p>
        <p className="text-[11px] text-text-muted">
          GemCheck provides pre-grade estimates only. Final grades are set by the grading company.
        </p>
        <div className="flex items-center gap-3">
          <Link
            to="/docs"
            className="text-[11px] text-text-muted hover:text-text-primary transition-colors"
          >
            API docs
          </Link>
          <span className="hidden sm:block text-[11px] text-text-muted">
            Built with ❤️ in the English Lake District
          </span>
        </div>
      </footer>

      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
