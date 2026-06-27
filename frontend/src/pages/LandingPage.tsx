import { useEffect, useMemo } from "react";
import { useAuth } from "../hooks/useAuth";
import { useMe } from "../hooks/useMe";
import { startCheckout, startGradeCheckout } from "../lib/api";
import type { Plan, SubscriptionPlan } from "../lib/plans";
import { SEO } from "../lib/marketingCopy";
import { scrollToSection } from "../lib/scrollToSection";
import {
  faqJsonLd,
  howToJsonLd,
  organizationJsonLd,
  usePageSeo,
  webSiteJsonLd,
} from "../lib/seo";
import { TopNav } from "../components/landing/TopNav";
import { HeroSection } from "../components/landing/HeroSection";
import { HowItWorksSection } from "../components/landing/CompareAndHow";
import { FeaturesSection, WhySection } from "../components/landing/FeaturesSection";
import { CropDemoSection } from "../components/landing/CropDemoSection";
import { ReviewsSection } from "../components/landing/SocialProof";
import { PricingSection, PlanCta } from "../components/landing/PricingSection";
import { ApiSection, SiteFooter } from "../components/landing/FooterSections";
import { ExpertReviewHomeSection } from "../components/landing/ExpertReviewHomeSection";
import { CollectorProfilesHomeSection } from "../collectorProfiles/landing/CollectorProfilesHomeSection";
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
  const plan: Plan | null =
    session && !me?.isAdmin ? (me?.plan ?? "free") : null;
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

  usePageSeo(
    useMemo(
      () => ({
        ...SEO.home,
        jsonLd: [organizationJsonLd(), webSiteJsonLd()],
      }),
      []
    )
  );

  useEffect(() => {
    if (window.location.hash !== "#expert-review") return;
    const timer = window.setTimeout(() => scrollToSection("expert-review"), 150);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-[100dvh] bg-surface text-text-primary">
      <TopNav loggedIn={loggedIn} plan={plan} isAdmin={isAdmin} onUpgrade={goCheckout} />
      <HeroSection loggedIn={loggedIn} plan={plan} isAdmin={isAdmin} />
      <HowItWorksSection />
      <WhatWeCheckSection />
      <GraderCompareSection />
      <ExpertReviewHomeSection loggedIn={loggedIn} />
      <CollectorProfilesHomeSection loggedIn={loggedIn} />
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
