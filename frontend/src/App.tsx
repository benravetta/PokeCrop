import { useEffect, type ReactNode } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "./hooks/useAuth";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminRoute } from "./components/AdminRoute";
import { LandingPage } from "./pages/LandingPage";
import { ToolPage } from "./pages/ToolPage";
import { AccountPage } from "./pages/AccountPage";
import { PricingPage } from "./pages/PricingPage";
import { AdminPage } from "./pages/AdminPage";
import { CatalogPage } from "./pages/CatalogPage";
import { GradePage } from "./pages/GradePage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { DocsPage } from "./pages/DocsPage";

function FullScreenLoader() {
  return (
    <div className="min-h-[100dvh] bg-surface flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-accent animate-spin" />
    </div>
  );
}

// Routes only an unauthenticated visitor should see (login/register/forgot).
function PublicOnly({ children }: { children: ReactNode }) {
  const { session, initializing } = useAuth();
  if (initializing) return <FullScreenLoader />;
  if (session) return <Navigate to="/crop" replace />;
  return <>{children}</>;
}

export default function App() {
  const init = useAuth((s) => s.init);

  useEffect(() => init(), [init]);

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnly>
            <LoginPage />
          </PublicOnly>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnly>
            <RegisterPage />
          </PublicOnly>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicOnly>
            <ForgotPasswordPage />
          </PublicOnly>
        }
      />
      {/* Reset must stay reachable while a recovery session is active. */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Public API documentation (no auth required). */}
      <Route path="/docs" element={<DocsPage />} />

      {/* Public marketing homepage. */}
      <Route path="/" element={<LandingPage />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/crop" element={<ToolPage />} />
        <Route path="/grade" element={<GradePage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/catalog"
          element={
            <AdminRoute>
              <CatalogPage />
            </AdminRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
