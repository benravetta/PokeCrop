import { useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { useMe } from "../hooks/useMe";
import { startCheckout } from "../lib/api";
import { TopNav } from "../components/landing/TopNav";
import { HeroSection } from "../components/landing/HeroSection";
import { HowItWorksSection } from "../components/landing/CompareAndHow";
import { FeaturesSection, WhySection } from "../components/landing/FeaturesSection";
import { ReportPreview } from "../components/landing/ReportPreview";
import { CropDemoSection } from "../components/landing/CropDemoSection";
import { ReviewsSection } from "../components/landing/SocialProof";
import { PricingSection, PlanCta } from "../components/landing/PricingSection";
import { ApiSection, HonestSection, SiteFooter } from "../components/landing/FooterSections";

type Plan = "free" | "unlimited" | "api" | null;

function useViewer() {
  const session = useAuth((s) => s.session);
  const me = useMe((s) => s.me);
  const refresh = useMe((s) => s.refresh);
  useEffect(() => {
    if (session) void refresh();
  }, [session, refresh]);
  const plan: Plan = session ? (me?.plan ?? "free") : null;
  return { loggedIn: !!session, plan };
}

async function goCheckout(plan: "unlimited" | "api") {
  try {
    const url = await startCheckout(plan);
    window.location.href = url;
  } catch {
    window.location.href = "/pricing";
  }
}

export function LandingPage() {
  const { loggedIn, plan } = useViewer();

  return (
    <div className="min-h-[100dvh] bg-surface text-text-primary">
      <TopNav loggedIn={loggedIn} plan={plan} onUpgrade={goCheckout} />
      <HeroSection loggedIn={loggedIn} plan={plan} />
      <HowItWorksSection />
      <WhySection />
      <FeaturesSection />
      <ReportPreview />
      <CropDemoSection />
      <ReviewsSection />
      <PricingSection loggedIn={loggedIn} plan={plan} onUpgrade={goCheckout} />
      <ApiSection plan={plan} loggedIn={loggedIn} onUpgrade={() => goCheckout("api")} />
      <PlanCta loggedIn={loggedIn} plan={plan} onUpgrade={goCheckout} />
      <HonestSection />
      <SiteFooter />
    </div>
  );
}
