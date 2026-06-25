import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, session, initializing } = useAuth();

  if (initializing) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  const isAdmin = user?.role === "admin";
  if (!isAdmin) return <Navigate to="/" replace />;

  return <>{children}</>;
}
