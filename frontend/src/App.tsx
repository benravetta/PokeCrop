import { useEffect, type ReactNode } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "./hooks/useAuth";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminRoute } from "./components/AdminRoute";
import { AdminLayout } from "./components/admin/AdminLayout";
import { LandingPage } from "./pages/LandingPage";
import { ToolPage } from "./pages/ToolPage";
import { AccountPage } from "./pages/AccountPage";
import { HistoryPage } from "./pages/HistoryPage";
import { PricingPage } from "./pages/PricingPage";
import { AdminOverviewPage } from "./pages/admin/AdminOverviewPage";
import { AdminUsersPage } from "./pages/admin/AdminUsersPage";
import { RevenuePage } from "./pages/admin/RevenuePage";
import { UsagePage } from "./pages/admin/UsagePage";
import { OperationsPage } from "./pages/admin/OperationsPage";
import { CatalogPage } from "./pages/CatalogPage";
import { GradePage } from "./pages/GradePage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { DocsPage } from "./pages/DocsPage";
import { HowItWorksPage } from "./pages/HowItWorksPage";
import { SampleReportPage } from "./pages/SampleReportPage";
import { FaqPage } from "./pages/FaqPage";
import { AboutPage } from "./pages/AboutPage";
import { ContactPage } from "./pages/ContactPage";
import { RequestAccessPage } from "./pages/RequestAccessPage";
import { TradePage } from "./pages/TradePage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { TermsPage } from "./pages/TermsPage";
import { RefundPage } from "./pages/RefundPage";
import { MarketingPageShell } from "./components/marketing/MarketingPageShell";
import { HumanPregradeLandingPage } from "./humanPregrade/pages/HumanPregradeLandingPage";
import { HumanPregradeNewPage } from "./humanPregrade/pages/HumanPregradeNewPage";
import { HumanPregradeOrdersPage } from "./humanPregrade/pages/HumanPregradeOrdersPage";
import {
  HumanPregradeOrderPage,
  HumanPregradeReportPage,
} from "./humanPregrade/pages/HumanPregradeOrderPage";
import { AdminHumanPregradesPage } from "./humanPregrade/admin/AdminHumanPregradesPage";
import { AdminHumanPregradeReviewPage } from "./humanPregrade/admin/AdminHumanPregradeReviewPage";
import { AdminHumanPregradeSettingsPage } from "./humanPregrade/admin/AdminHumanPregradeSettingsPage";

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

  useEffect(() => {
    void init();
  }, [init]);

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
      <Route path="/how-it-works" element={<HowItWorksPage />} />
      <Route path="/sample-report" element={<SampleReportPage />} />
      <Route path="/faq" element={<FaqPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/request-access" element={<RequestAccessPage />} />
      <Route path="/trade" element={<TradePage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/refund" element={<RefundPage />} />
      <Route
        path="/pricing"
        element={
          <MarketingPageShell wide>
            <PricingPage />
          </MarketingPageShell>
        }
      />

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
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/human-pregrade" element={<HumanPregradeLandingPage />} />
        <Route path="/human-pregrade/new" element={<HumanPregradeNewPage />} />
        <Route path="/human-pregrade/orders" element={<HumanPregradeOrdersPage />} />
        <Route path="/human-pregrade/orders/:publicId" element={<HumanPregradeOrderPage />} />
        <Route path="/human-pregrade/orders/:publicId/report" element={<HumanPregradeReportPage />} />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route index element={<AdminOverviewPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="revenue" element={<RevenuePage />} />
          <Route path="usage" element={<UsagePage />} />
          <Route path="operations" element={<OperationsPage />} />
          <Route path="catalog" element={<CatalogPage />} />
          <Route path="human-pregrades" element={<AdminHumanPregradesPage />} />
          <Route path="human-pregrades/settings" element={<AdminHumanPregradeSettingsPage />} />
          <Route path="human-pregrades/:id/review" element={<AdminHumanPregradeReviewPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
