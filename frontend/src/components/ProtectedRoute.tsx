import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, initializing } = useAuth();
  const location = useLocation();

  if (initializing) {
    return (
      <div className="min-h-[100dvh] bg-surface flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <Navigate
        to="/login"
        state={{ from: `${location.pathname}${location.search}` }}
        replace
      />
    );
  }

  return <>{children}</>;
}
