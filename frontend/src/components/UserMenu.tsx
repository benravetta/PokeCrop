import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, Settings, Shield, ChevronDown, History } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { AdminBadge } from "../lib/adminAccess";

export function UserMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!user) return null;

  const isAdmin = user.role === "admin";
  const email = user.email ?? "Account";
  const initial = email.charAt(0).toUpperCase();

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full hover:bg-surface-overlay transition-colors"
        title={email}
      >
        <span className="w-6 h-6 rounded-full bg-accent/20 text-accent text-xs font-semibold flex items-center justify-center">
          {initial}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-surface-overlay border border-border-subtle shadow-2xl overflow-hidden anim-rise z-30">
          <div className="px-4 py-3 border-b border-border-subtle">
            <p className="text-[11px] text-text-muted">Signed in as</p>
            <p className="text-sm text-text-primary truncate">{email}</p>
            {isAdmin && (
              <div className="mt-2">
                <AdminBadge />
              </div>
            )}
          </div>
          <Link
            to="/account"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-text-secondary hover:bg-border-subtle hover:text-text-primary transition-colors"
          >
            <Settings className="w-4 h-4" />
            {isAdmin ? "Account" : "Account & billing"}
          </Link>
          <Link
            to="/history"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-text-secondary hover:bg-border-subtle hover:text-text-primary transition-colors"
          >
            <History className="w-4 h-4" />
            History
          </Link>
          {isAdmin && (
            <Link
              to="/admin"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-text-secondary hover:bg-border-subtle hover:text-text-primary transition-colors"
            >
              <Shield className="w-4 h-4" />
              Ops console
            </Link>
          )}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-text-secondary hover:bg-border-subtle hover:text-text-primary transition-colors border-t border-border-subtle"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
