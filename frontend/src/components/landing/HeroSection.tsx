import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check, Upload, UserCheck } from "lucide-react";
import { HERO_CARD_IMG, SINGLE_GRADE } from "./data";
import { AppWindow } from "./shared";
import { ESTIMATE_DISCLAIMER_SHORT, HERO, NAV } from "../../lib/marketingCopy";
import { EXPERT_REVIEW } from "../../humanPregrade/landing/expertReviewCopy";
import { STAFF_ACCOUNT } from "../../lib/adminAccess";
import { PLAN_LABELS, type Plan } from "../../lib/plans";
import {
  guestIntentPath,
  guestPrimaryCtaLabel,
  useInviteRequired,
} from "../../hooks/useInviteRequired";
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
  const gradePath = loggedIn ? "/grade" : guestIntentPath(inviteRequired, "grade");
  const cropPath = loggedIn ? "/crop" : guestIntentPath(inviteRequired, "crop");
  const guestPrimaryLabel = guestPrimaryCtaLabel(inviteRequired);

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
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-14">
          <div className="mx-auto max-w-xl text-center anim-rise lg:mx-0 lg:max-w-none lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
              {HERO.eyebrow}
            </div>

            <h1 className="mt-5 text-4xl font-semibold leading-[1.06] tracking-tight text-balance sm:text-5xl lg:text-[3.25rem]">
              Know before{" "}
              <span className="bg-gradient-to-r from-accent via-violet-400 to-sky-400 bg-clip-text text-transparent">
                you grade
              </span>
            </h1>

            <p className="mt-4 text-base leading-relaxed text-text-secondary sm:text-lg">
              {HERO.subhead}
            </p>

            <ul className="mt-7 space-y-2.5 text-left">
              {HERO.bullets.map((line) => (
                <li key={line} className="flex items-start gap-2.5 text-sm text-text-secondary">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>

            <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:justify-center lg:justify-start">
              <Link
                to={gradePath}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition-all hover:bg-accent-hover sm:w-auto"
              >
                <Upload className="h-4 w-4" aria-hidden />
                {loggedIn ? "Grade this card" : `${guestPrimaryLabel}`}
              </Link>
              <Link
                to={cropPath}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface-raised/60 px-6 py-3.5 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-overlay sm:w-auto"
              >
                Just crop image
              </Link>
              {!loggedIn && inviteRequired ? (
                <Link
                  to="/login?intent=grade"
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
                  <ArrowRight className="h-4 w-4 text-text-muted" aria-hidden />
                </Link>
              )}
            </div>

            <p className="mt-3 text-sm text-text-muted">{supportLine}</p>

            <div className="mt-6 rounded-xl border border-border-subtle bg-surface-raised/40 p-4 text-left">
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
                className="group flex items-start gap-3 transition-colors hover:text-text-primary"
              >
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/15">
                  <UserCheck className="h-4 w-4 text-sky-400" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-text-primary">
                    {EXPERT_REVIEW.home.heroTeaser}
                    <ArrowRight
                      className="h-3.5 w-3.5 text-text-muted transition group-hover:translate-x-0.5 group-hover:text-sky-400"
                      aria-hidden
                    />
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-text-muted">
                    Human expert review with a written report before expensive submissions.
                  </span>
                </span>
              </a>
            </div>

            <p className="mt-5 text-xs leading-relaxed text-text-muted/80">{HERO.qualification}</p>
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
    <div className="anim-scale relative mx-auto w-full max-w-[420px] py-4 sm:py-6 lg:max-w-[460px]">
      <div
        aria-hidden
        className="pointer-events-none absolute left-0 top-1/2 z-0 w-[58%] max-w-[260px] -translate-y-[48%] sm:-left-2 sm:w-[54%]"
      >
        <div
          className="absolute -inset-4 rounded-3xl bg-accent/8 opacity-70 blur-2xl"
          aria-hidden
        />
        <img
          src={HERO_CARD_IMG}
          alt=""
          draggable={false}
          className="relative h-auto w-full select-none drop-shadow-[0_28px_56px_rgba(0,0,0,0.55)]"
        />
      </div>

      <div className="relative z-10 ml-[26%] sm:ml-[30%]">
        <AppWindow title="GemCheck pre-grade report">
          <div className="bg-surface-raised p-4 sm:p-5">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
                Card identified
              </div>
              <div className="mt-0.5 text-base font-semibold leading-tight">Charizard</div>
              <div className="mt-0.5 text-[11px] leading-snug text-text-muted">
                Base Set · 1st Ed · Holo · 4/102
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-text-muted">
                Grader estimates
              </div>
              <div className="space-y-1">
                {grades.map(({ co, g, recommended: isRec }) =>
                  isRec ? (
                    <div
                      key={co}
                      className="flex items-center justify-between rounded-lg border border-success/35 bg-success/12 px-3 py-2"
                    >
                      <div>
                        <span className="text-sm font-semibold text-success">{co}</span>
                        <span className="mt-0.5 block text-[10px] font-medium text-success/80">
                          Likely best fit
                        </span>
                      </div>
                      <span className="text-2xl font-bold leading-none tabular-nums text-success">
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

            <div className="mt-4 flex items-start gap-2 border-t border-border-subtle pt-4">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
              <p className="text-xs leading-relaxed text-text-secondary">
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
