import { Link } from "react-router-dom";
import { ArrowRight, FileDown, Upload } from "lucide-react";
import { HERO_REVIEW, STATS } from "./data";
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
                ? "Free plan — 1 grade a month, 3 crops a day."
                : plan === "unlimited"
                  ? "Unlimited plan active."
                  : plan === "api"
                    ? "API plan active."
                    : "Free to start. No card details required."}
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

/** UI-only product preview — no card photography. */
function ProductPreview() {
  const grades = [
    { co: "PSA", g: "8" },
    { co: "Beckett", g: "8.5" },
    { co: "CGC", g: "8.5" },
    { co: "ACE", g: "8.0" },
    { co: "TAG", g: "8.2" },
  ];

  const scores = [
    { label: "Corners", score: 7.5 },
    { label: "Edges", score: 8.0 },
    { label: "Surface", score: 8.5 },
    { label: "Eye appeal", score: 8.0 },
  ];

  return (
    <div className="anim-scale">
      <AppWindow title="GemCheck — Pre-grade report">
        <div className="p-4 sm:p-5 space-y-4">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-text-muted font-medium">
              Card identified
            </div>
            <div className="mt-1 text-sm font-semibold">Erika&apos;s Oddish</div>
            <div className="text-xs text-text-muted">Gym Heroes · 1st Edition</div>
          </div>

          <div className="rounded-xl border border-border-subtle bg-surface-overlay/40 p-3">
            <div className="text-[10px] font-medium text-text-muted uppercase tracking-wide">
              Estimated grade by company
            </div>
            <div className="mt-2 space-y-1.5">
              {grades.map(({ co, g }) => (
                <div key={co} className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">{co}</span>
                  <span className="font-semibold tabular-nums">{g}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-accent/10 border border-accent/20 px-3 py-2">
            <div className="text-xs font-semibold text-accent">Possible — inspect first</div>
            <div className="text-[11px] text-text-secondary mt-0.5">Best fit: CGC or Beckett</div>
          </div>

          <div className="space-y-2">
            {scores.map(({ label, score }) => (
              <div key={label} className="flex items-center gap-3 text-xs">
                <span className="w-16 text-text-muted shrink-0">{label}</span>
                <div className="flex-1 h-1.5 rounded-full bg-surface-overlay overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent/70"
                    style={{ width: `${score * 10}%` }}
                  />
                </div>
                <span className="w-6 tabular-nums text-text-secondary">{score.toFixed(1)}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border-subtle px-3 py-2.5">
            <span className="text-xs text-text-secondary">Full PDF report</span>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1 text-[11px] font-semibold text-white">
              <FileDown className="w-3.5 h-3.5" />
              Download
            </span>
          </div>
        </div>
      </AppWindow>
    </div>
  );
}
