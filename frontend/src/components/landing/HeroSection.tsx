import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Upload } from "lucide-react";
import { HERO_CARD_IMG, HERO_REVIEW, SINGLE_GRADE, STATS } from "./data";
import { AppWindow, StarRating } from "./shared";

type Plan = "free" | "unlimited" | "api" | null;

export function HeroSection({ loggedIn, plan }: { loggedIn: boolean; plan: Plan }) {
  const primary = loggedIn
    ? { to: "/crop", label: "Open the app" }
    : { to: "/register", label: "Check a card free" };

  return (
    <section id="top" className="relative overflow-hidden landing-mesh">
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-14 pb-16 sm:pt-20 sm:pb-20">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-14 items-center">
          <div className="text-center lg:text-left anim-rise">
            <h1 className="text-4xl sm:text-5xl lg:text-[3.1rem] font-semibold tracking-tight leading-[1.08] text-balance">
              Stop paying to find out
              <span className="block text-accent">what grade you got.</span>
            </h1>

            <p className="mt-5 text-base sm:text-lg text-text-secondary max-w-lg mx-auto lg:mx-0 leading-relaxed">
              GemCheck gives you a pre-grade across PSA, Beckett, CGC and more — plus a prep
              checklist — before you post a card off.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Link
                to={primary.to}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-sm font-semibold text-white hover:bg-accent-hover transition-all shadow-lg shadow-accent/25"
              >
                <Upload className="w-4 h-4" />
                {primary.label}
              </Link>
              <a
                href="#report"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface-raised/60 px-6 py-3.5 text-sm font-semibold text-text-primary hover:bg-surface-overlay transition-colors"
              >
                See sample report
                <ArrowRight className="w-4 h-4 text-text-muted" />
              </a>
            </div>

            <p className="mt-4 text-sm text-text-muted">
              {plan === "free"
                ? `Free plan — 1 grade a month, 3 crops a day. Need another? ${SINGLE_GRADE.price} per report.`
                : plan === "unlimited"
                  ? "Unlimited plan active."
                  : plan === "api"
                    ? "API plan active."
                    : `Free to start. Or buy a single report for ${SINGLE_GRADE.price} — no subscription.`}
            </p>

            <div className="mt-8 flex flex-wrap justify-center lg:justify-start gap-x-8 gap-y-3">
              {STATS.slice(0, 3).map((s) => (
                <div key={s.label}>
                  <div className="text-lg font-semibold text-text-primary">{s.value}</div>
                  <div className="text-xs text-text-muted">{s.label}</div>
                </div>
              ))}
            </div>

            <figure className="mt-8 rounded-2xl border border-border-subtle bg-surface-raised/80 p-4 text-left max-w-lg mx-auto lg:mx-0">
              <StarRating count={HERO_REVIEW.rating} />
              <blockquote className="mt-2 text-sm text-text-secondary leading-relaxed">
                &ldquo;{HERO_REVIEW.text}&rdquo;
              </blockquote>
              <figcaption className="mt-3 text-xs text-text-muted">
                {HERO_REVIEW.name} · {HERO_REVIEW.role}
              </figcaption>
            </figure>
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
      {/* Card — larger, sits behind the report window */}
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

      {/* Report — overlaps the card on the right */}
      <div className="relative z-10 ml-[26%] sm:ml-[30%]">
        <AppWindow title="GemCheck — Pre-grade report">
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
                Estimated grade
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
                Every company weighs centring, corners and surface differently — compare estimates
                before you choose where to submit.
              </p>
            </div>
          </div>
        </AppWindow>
      </div>
    </div>
  );
}
