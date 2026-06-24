import { useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { useMe } from "../hooks/useMe";
import { startCheckout, startGradeCheckout } from "../lib/api";
import type { Plan, SubscriptionPlan } from "../lib/plans";
import { SEO } from "../lib/marketingCopy";
import { TopNav } from "../components/landing/TopNav";
import { HeroSection } from "../components/landing/HeroSection";
import { HowItWorksSection } from "../components/landing/CompareAndHow";
import { FeaturesSection, WhySection } from "../components/landing/FeaturesSection";
import { ReportPreview } from "../components/landing/ReportPreview";
import { CropDemoSection } from "../components/landing/CropDemoSection";
import { ReviewsSection } from "../components/landing/SocialProof";
import { PricingSection, PlanCta } from "../components/landing/PricingSection";
import { ApiSection, SiteFooter } from "../components/landing/FooterSections";
import {
  FaqStripSection,
  GraderCompareSection,
  TradeTeaserSection,
  TransparencySection,
  WhatWeCheckSection,
} from "../components/marketing/MarketingSections";

function useViewer() {
  const session = useAuth((s) => s.session);
  const me = useMe((s) => s.me);
  const refresh = useMe((s) => s.refresh);
  useEffect(() => {
    if (session) void refresh();
  }, [session, refresh]);
  const plan: Plan | null = session ? (me?.plan ?? "free") : null;
  const isAdmin = me?.isAdmin === true;
  return { loggedIn: !!session, plan, isAdmin };
}

async function goBuyGrade() {
  try {
    const { url } = await startGradeCheckout();
    window.location.href = url;
  } catch {
    window.location.href = "/account";
  }
}

async function goCheckout(plan: SubscriptionPlan) {
  try {
    const url = await startCheckout(plan);
    window.location.href = url;
  } catch {
    window.location.href = "/pricing";
  }
}

export function LandingPage() {
  const { loggedIn, plan, isAdmin } = useViewer();

  useEffect(() => {
    document.title = SEO.home.title;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", SEO.home.description);
  }, []);

  return (
    <div className="min-h-[100dvh] bg-surface text-text-primary">
      <TopNav loggedIn={loggedIn} plan={plan} isAdmin={isAdmin} onUpgrade={goCheckout} />
      <HeroSection loggedIn={loggedIn} plan={plan} isAdmin={isAdmin} />
      <ReportPreview />
      <HowItWorksSection />
      <WhatWeCheckSection />
      <GraderCompareSection />
      <TransparencySection />
      <ReviewsSection />
      <PricingSection
        loggedIn={loggedIn}
        plan={plan}
        isAdmin={isAdmin}
        onUpgrade={goCheckout}
        onBuyGrade={goBuyGrade}
      />
      <FaqStripSection />
      <PlanCta loggedIn={loggedIn} plan={plan} isAdmin={isAdmin} onUpgrade={goCheckout} onBuyGrade={goBuyGrade} />
      <WhySection />
      <FeaturesSection />
      <CropDemoSection />
      <TradeTeaserSection />
      <ApiSection plan={plan} loggedIn={loggedIn} isAdmin={isAdmin} onUpgrade={() => goCheckout("api")} />
      <SiteFooter />
    </div>
  );
}
