import { Link } from "react-router-dom";
import { ArrowRight, Camera, FileDown, ScanSearch, Upload } from "lucide-react";
import { AFTER_IMG } from "./data";
import { AppWindow, DemoCardThumb, HoloCard } from "./shared";

type Plan = "free" | "unlimited" | "api" | null;

export function HeroSection({ loggedIn, plan }: { loggedIn: boolean; plan: Plan }) {
  const primary = loggedIn
    ? { to: "/crop", label: "Open the app" }
    : { to: "/register", label: "Check a card free" };

  return (
    <section id="top" className="relative overflow-hidden landing-mesh">
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-14 pb-20 sm:pt-20 sm:pb-28">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-10 items-center">
          <div className="text-center lg:text-left anim-rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface-raised/80 px-3.5 py-1.5 text-xs font-medium text-text-secondary">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              For Pokémon &amp; TCG collectors
            </span>

            <h1 className="mt-6 text-4xl sm:text-5xl lg:text-[3.25rem] font-semibold tracking-tight leading-[1.06] text-balance">
              Know the grade
              <span className="block text-accent">before you pay to grade.</span>
            </h1>

            <p className="mt-5 text-base sm:text-lg text-text-secondary max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Snap your card, get an honest pre-grade across PSA, Beckett, CGC and more — plus
              exactly what&apos;s holding it back and how to fix it. No guesswork, no wasted
              submissions.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Link
                to={primary.to}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-sm font-semibold text-white hover:bg-accent-hover transition-all shadow-lg shadow-accent/25 hover:shadow-accent/35"
              >
                <Upload className="w-4 h-4" />
                {primary.label}
              </Link>
              <a
                href="#report"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface-raised/60 px-6 py-3.5 text-sm font-semibold text-text-primary hover:bg-surface-overlay transition-colors"
              >
                See a sample report
                <ArrowRight className="w-4 h-4 text-text-muted" />
              </a>
            </div>

            <p className="mt-5 text-sm text-text-muted">
              {plan === "free"
                ? "You're on the free plan — 1 grade a month and 3 crops a day."
                : plan === "unlimited"
                  ? "Unlimited crops and 10 grades a day active."
                  : plan === "api"
                    ? "API plan active — manage keys in your account."
                    : "Free to start. No card details required."}
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-2 text-xs text-text-muted">
              <span className="flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-accent" />
                Phone photo works
              </span>
              <span className="flex items-center gap-1.5">
                <FileDown className="w-3.5 h-3.5 text-accent" />
                Downloadable PDF report
              </span>
              <span className="flex items-center gap-1.5">
                <ScanSearch className="w-3.5 h-3.5 text-accent" />
                5 grading companies
              </span>
            </div>
          </div>

          <HeroVisual />
        </div>
      </div>
    </section>
  );
}

function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-lg lg:max-w-none anim-scale pb-16 sm:pb-20 lg:pb-0">
      <div className="relative">
        <AppWindow title="GemCheck — Grade" className="relative z-10">
          <div className="p-4 sm:p-5">
            <div className="flex gap-3">
              <div className="flex-1 space-y-2">
                <div className="text-[10px] uppercase tracking-wide text-text-muted font-medium">
                  Front &amp; back
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <DemoCardThumb className="w-full aspect-[2.5/3.5]" />
                  <div className="w-full aspect-[2.5/3.5] rounded border border-dashed border-border-subtle bg-surface-overlay/40 flex items-center justify-center">
                    <Camera className="w-5 h-5 text-text-muted" />
                  </div>
                </div>
              </div>
              <div className="w-[44%] rounded-xl border border-border-subtle bg-surface-overlay/50 p-3">
                <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">
                  Erika&apos;s Oddish
                </div>
                <div className="mt-2 space-y-1.5">
                  {[
                    ["PSA", "8"],
                    ["BGS", "8.5"],
                    ["CGC", "8.5"],
                  ].map(([co, g]) => (
                    <div
                      key={co}
                      className="flex items-center justify-between rounded-lg bg-surface-raised px-2 py-1"
                    >
                      <span className="text-[11px] text-text-secondary">{co}</span>
                      <span className="text-xs font-semibold">{g}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 rounded-lg bg-accent/10 px-2 py-1.5 text-[10px] text-accent leading-snug">
                  Best fit: CGC or Beckett
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-lg border border-border-subtle bg-surface-overlay/30 px-3 py-2">
              <span className="text-[11px] text-text-secondary">Pre-grade report ready</span>
              <span className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-[10px] font-semibold text-white">
                <FileDown className="w-3 h-3" />
                PDF
              </span>
            </div>
          </div>
        </AppWindow>

        <div className="absolute -left-4 sm:-left-8 top-[58%] w-[52%] z-20 animate-[float_6s_ease-in-out_infinite]">
          <HoloCard src={AFTER_IMG} alt="Erika's Oddish trading card" />
        </div>

        <AppWindow
          title="GemCheck — Crop"
          className="absolute -right-2 sm:-right-6 -bottom-8 w-[58%] z-30 shadow-2xl animate-[float-slow_7s_ease-in-out_infinite]"
        >
          <div className="p-3">
            <div className="checkerboard rounded-lg aspect-[4/3] flex items-center justify-center p-3">
              <img
                src={AFTER_IMG}
                alt=""
                className="max-h-full max-w-full rounded-[3%] drop-shadow-lg"
                draggable={false}
              />
            </div>
            <div className="mt-2 flex gap-1.5">
              <span className="flex-1 rounded-md bg-accent/15 text-accent text-[9px] font-semibold py-1 text-center">
                Original PNG
              </span>
              <span className="flex-1 rounded-md bg-surface-overlay text-text-muted text-[9px] font-medium py-1 text-center">
                Web PNG
              </span>
            </div>
          </div>
        </AppWindow>
      </div>
    </div>
  );
}
