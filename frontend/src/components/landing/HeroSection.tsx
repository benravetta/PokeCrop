import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, Upload, UserCheck } from "lucide-react";
import { HERO_CARD_IMG, SINGLE_GRADE } from "./data";
import { AppWindow } from "./shared";
import { ESTIMATE_DISCLAIMER_SHORT, HERO, NAV, TRUST_STRIP } from "../../lib/marketingCopy";
import { EXPERT_REVIEW } from "../../humanPregrade/landing/expertReviewCopy";
import { STAFF_ACCOUNT } from "../../lib/adminAccess";
import { PLAN_LABELS, type Plan } from "../../lib/plans";
import { guestPrimaryCtaLabel, guestSignupPath, useInviteRequired } from "../../hooks/useInviteRequired";
import { scrollToSection } from "../../lib/scrollToSection";

export function HeroSection({
  loggedIn,
  plan,
  isAdmin = false,
}: {
  loggedIn: boolean;
  plan: Plan | null;
  isAdmin?: boolean;
}) {
  const navigate = useNavigate();
  const { inviteRequired } = useInviteRequired();
  const primary = loggedIn
    ? { to: "/grade", label: HERO.primaryCtaLoggedIn }
    : {
        to: guestSignupPath(inviteRequired),
        label: guestPrimaryCtaLabel(inviteRequired),
      };

  const supportLine = isAdmin
    ? STAFF_ACCOUNT.heroSupport
    : plan === "free"
      ? HERO.supportFreePlan(SINGLE_GRADE.price)
      : plan
        ? `${PLAN_LABELS[plan]} plan active.`
        : HERO.supportGuest;

  return (
    <section id="top" className="relative overflow-hidden landing-mesh">
      <div className="relative mx-auto w-full max-w-6xl page-x pt-14 pb-16 sm:pt-20 sm:pb-20">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-14 items-center">
          <div className="text-center lg:text-left anim-rise">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent mb-3">
              {HERO.eyebrow}
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-[3.1rem] font-semibold tracking-tight leading-[1.08] text-balance">
              {HERO.h1}
            </h1>

            <p className="mt-5 text-base sm:text-lg text-text-secondary max-w-lg mx-auto lg:mx-0 leading-relaxed">
              {HERO.body}
            </p>

            <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:w-auto justify-center lg:justify-start">
              <Link
                to={primary.to}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition-all hover:bg-accent-hover sm:w-auto"
              >
                <Upload className="w-4 h-4" />
                {primary.label}
              </Link>
              {!loggedIn && inviteRequired ? (
                <Link
                  to="/login"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface-raised/60 px-6 py-3.5 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-overlay sm:w-auto"
                >
                  {NAV.signIn}
                </Link>
              ) : (
                <Link
                  to="/sample-report"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface-raised/60 px-6 py-3.5 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-overlay sm:w-auto"
                >
                  {HERO.secondaryCta}
                  <ArrowRight className="w-4 h-4 text-text-muted" />
                </Link>
              )}
            </div>

            <a
              href="#expert-review"
              onClick={(e) => {
                if (scrollToSection("expert-review")) {
                  e.preventDefault();
                  return;
                }
                e.preventDefault();
                void navigate("/human-pregrade");
              }}
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-sky-300/90 transition hover:text-sky-200"
            >
              <UserCheck className="h-4 w-4 shrink-0" />
              {EXPERT_REVIEW.home.heroTeaser}
              <ArrowRight className="h-3.5 w-3.5" />
            </a>

            <p className="mt-4 text-sm text-text-muted">{supportLine}</p>

            <div className="mt-8 flex flex-wrap justify-center lg:justify-start gap-x-4 gap-y-2">
              {TRUST_STRIP.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-1.5 text-xs text-text-secondary"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" />
                  {item}
                </span>
              ))}
            </div>

            <p className="mt-6 text-xs text-text-muted max-w-lg mx-auto lg:mx-0 leading-relaxed">
              {HERO.qualification}
            </p>
          </div>

          <ProductPreview />
        </div>
      </div>
    </section>
  );
}

/** Report panel with the cropped card layered behind — peeking out on the left. */
function ProductPreview() {
  const grades: { co: string; g: string; recommended?: boolean }[] = [
    { co: "PSA", g: "9" },
    { co: "Beckett", g: "9.5" },
    { co: "CGC", g: "10", recommended: true },
    { co: "ACE", g: "9.0" },
    { co: "TAG", g: "9.4" },
  ];

  const recommended = grades.find((g) => g.recommended)!;

  return (
    <div className="anim-scale relative w-full max-w-[420px] lg:max-w-[460px] mx-auto py-4 sm:py-6">
      <div
        aria-hidden
        className="pointer-events-none absolute left-0 sm:-left-2 top-1/2 -translate-y-[48%] z-0 w-[58%] sm:w-[54%] max-w-[260px]"
      >
        <div
          className="absolute -inset-4 rounded-3xl bg-accent/8 blur-2xl opacity-70"
          aria-hidden
        />
        <img
          src={HERO_CARD_IMG}
          alt=""
          draggable={false}
          className="relative w-full h-auto select-none drop-shadow-[0_28px_56px_rgba(0,0,0,0.55)]"
        />
      </div>

      <div className="relative z-10 ml-[26%] sm:ml-[30%]">
        <AppWindow title="GemCheck pre-grade report">
          <div className="p-4 sm:p-5 bg-surface-raised">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-text-muted font-medium">
                Card identified
              </div>
              <div className="mt-0.5 text-base font-semibold leading-tight">Charizard</div>
              <div className="text-[11px] text-text-muted mt-0.5 leading-snug">
                Base Set · 1st Ed · Holo · 4/102
              </div>
            </div>

            <div className="mt-4">
              <div className="text-[10px] uppercase tracking-wider text-text-muted font-medium mb-2">
                Grader estimates
              </div>
              <div className="space-y-1">
                {grades.map(({ co, g, recommended: isRec }) =>
                  isRec ? (
                    <div
                      key={co}
                      className="flex items-center justify-between rounded-lg bg-success/12 border border-success/35 px-3 py-2"
                    >
                      <div>
                        <span className="text-sm font-semibold text-success">{co}</span>
                        <span className="block text-[10px] font-medium text-success/80 mt-0.5">
                          Likely best fit
                        </span>
                      </div>
                      <span className="text-2xl font-bold tabular-nums text-success leading-none">
                        {g}
                      </span>
                    </div>
                  ) : (
                    <div
                      key={co}
                      className="flex items-center justify-between px-3 py-1 text-sm"
                    >
                      <span className="text-text-muted">{co}</span>
                      <span className="font-medium tabular-nums text-text-secondary">{g}</span>
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-border-subtle flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
              <p className="text-xs text-text-secondary leading-relaxed">
                <span className="font-medium text-text-primary">
                  {recommended.co} looks like the strongest match for this card.
                </span>{" "}
                {ESTIMATE_DISCLAIMER_SHORT} Each company weights centring, corners, edges and
                surface differently.
              </p>
            </div>
          </div>
        </AppWindow>
      </div>
    </div>
  );
}
