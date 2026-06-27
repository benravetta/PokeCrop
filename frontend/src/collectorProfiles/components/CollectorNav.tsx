import { NavLink } from "react-router-dom";
import {
  ExternalLink,
  LayoutGrid,
  MessageSquare,
  Repeat2,
  UserCircle,
} from "lucide-react";
import { COLLECTOR_COPY } from "../copy";

const items = [
  { to: "/collector/profile", label: COLLECTOR_COPY.nav.overview, icon: UserCircle, end: true },
  { to: "/collector/cards", label: COLLECTOR_COPY.nav.cards, icon: LayoutGrid },
  { to: "/collector/trades", label: COLLECTOR_COPY.nav.trades, icon: Repeat2 },
  { to: "/collector/messages", label: COLLECTOR_COPY.nav.messages, icon: MessageSquare },
] as const;

function navClass(isActive: boolean, compact?: boolean) {
  const base = compact
    ? "inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition"
    : "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition";
  return isActive
    ? `${base} bg-accent/15 text-accent`
    : `${base} text-text-secondary hover:bg-surface-overlay hover:text-text-primary`;
}

export function CollectorNavMobile() {
  return (
    <nav className="flex gap-2 overflow-x-auto pb-1 lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map(({ to, label, icon: Icon, ...rest }) => (
        <NavLink key={to} to={to} {...rest} className={({ isActive }) => navClass(isActive, true)}>
          <Icon className="h-4 w-4" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export function CollectorNavSidebar({
  username,
  displayName,
  status,
}: {
  username?: string;
  displayName?: string;
  status?: string;
}) {
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-6 space-y-5">
        {(displayName || username) && (
          <div className="rounded-2xl border border-border-subtle bg-surface-raised p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/15 text-accent">
                <UserCircle className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold text-text-primary">{displayName ?? username}</p>
                {username && <p className="truncate text-xs text-text-secondary">@{username}</p>}
              </div>
            </div>
            {status && (
              <p className="mt-3 text-[11px] uppercase tracking-wide text-text-muted">
                {status === "active" ? "Profile live" : "Draft — publish when ready"}
              </p>
            )}
            {username && status === "active" && (
              <a
                href={`/u/${username}`}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
              >
                {COLLECTOR_COPY.nav.viewPublic}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        )}

        <nav className="space-y-1">
          {items.map(({ to, label, icon: Icon, ...rest }) => (
            <NavLink key={to} to={to} {...rest} className={({ isActive }) => navClass(isActive)}>
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </aside>
  );
}
