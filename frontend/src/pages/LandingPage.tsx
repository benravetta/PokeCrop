import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Upload,
  ArrowRight,
  Camera,
  ScanSearch,
  Scale,
  Check,
  Menu,
  X,
  ShieldCheck,
  Sparkles,
  MoveHorizontal,
  Terminal,
  KeyRound,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  Wallet,
  Clock,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useMe } from "../hooks/useMe";
import { startCheckout } from "../lib/api";

const BEFORE_IMG = "/demo-before.jpg?v=oddish4";
const AFTER_IMG = "/demo-after.png?v=oddish4";

type Plan = "free" | "unlimited" | "api" | null;

/** Logged-in plan ("free"/"unlimited"/"api") or null when signed out. */
function useViewer() {
  const session = useAuth((s) => s.session);
  const me = useMe((s) => s.me);
  const refresh = useMe((s) => s.refresh);
  useEffect(() => {
    if (session) void refresh();
  }, [session, refresh]);
  const plan: Plan = session ? me?.plan ?? "free" : null;
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

const NAV_LINKS = [
  { label: "How it works", href: "#how" },
  { label: "The report", href: "#report" },
  { label: "Prepare", href: "#prepare" },
  { label: "Compare graders", href: "#compare" },
  { label: "Developers", href: "#api" },
];

export function LandingPage() {
  const { loggedIn, plan } = useViewer();
  return (
    <div className="min-h-[100dvh] bg-surface text-text-primary">
      <TopNav loggedIn={loggedIn} plan={plan} />
      <Hero loggedIn={loggedIn} plan={plan} />
      <CostStrip />
      <ReportSection />
      <PrepareSection />
      <CompareSection />
      <HowItWorks />
      <ApiSection plan={plan} loggedIn={loggedIn} />
      <PlanCta loggedIn={loggedIn} plan={plan} />
      <HonestSection />
      <SiteFooter />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Brand                                                               */
/* ------------------------------------------------------------------ */

function Wordmark({ className = "h-8" }: { className?: string }) {
  return (
    <img
      src="/gemcheck-logo.png"
      alt="GemCheck — by Looky"
      className={`${className} w-auto select-none`}
      draggable={false}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

function PlanBadge({ plan }: { plan: Exclude<Plan, null> }) {
  const labels: Record<string, string> = {
    free: "Free plan",
    unlimited: "Unlimited",
    api: "API plan",
  };
  return (
    <span className="rounded-full border border-border-subtle bg-surface-overlay/60 px-2.5 py-1 text-[11px] font-medium text-text-secondary">
      {labels[plan]}
    </span>
  );
}

function TopNav({ loggedIn, plan }: { loggedIn: boolean; plan: Plan }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-colors duration-300 ${
        scrolled
          ? "bg-surface/85 backdrop-blur-md border-b border-border-subtle"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <a href="#top" className="shrink-0">
          <Wordmark className="h-10 sm:h-11" />
        </a>

        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="px-3 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-overlay/60 transition-colors"
            >
              {l.label}
            </a>
          ))}
          <Link
            to="/pricing"
            className="px-3 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-overlay/60 transition-colors"
          >
            Pricing
          </Link>
        </nav>

        <div className="hidden md:flex items-center gap-2">
          {loggedIn ? (
            <>
              {plan && <PlanBadge plan={plan} />}
              {plan === "free" && (
                <button
                  onClick={() => goCheckout("unlimited")}
                  className="px-3 py-2 rounded-lg text-sm font-semibold text-accent hover:bg-accent/10 transition-colors"
                >
                  Upgrade
                </button>
              )}
              {plan === "unlimited" && (
                <button
                  onClick={() => goCheckout("api")}
                  className="px-3 py-2 rounded-lg text-sm font-semibold text-accent hover:bg-accent/10 transition-colors"
                >
                  Get API access
                </button>
              )}
              <Link
                to="/crop"
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20"
              >
                <Upload className="w-4 h-4" />
                Open app
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="px-3 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20"
              >
                Check a card free
              </Link>
            </>
          )}
        </div>

        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg text-text-secondary hover:bg-surface-overlay"
          aria-label="Toggle menu"
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-border-subtle bg-surface/95 backdrop-blur-md px-4 py-3 anim-fade">
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="px-3 py-2.5 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-overlay transition-colors"
              >
                {l.label}
              </a>
            ))}
            <Link
              to="/pricing"
              onClick={() => setMenuOpen(false)}
              className="px-3 py-2.5 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-overlay transition-colors"
            >
              Pricing
            </Link>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {loggedIn ? (
                <>
                  <Link
                    to="/account"
                    onClick={() => setMenuOpen(false)}
                    className="rounded-lg border border-border-strong px-4 py-2.5 text-sm font-medium text-center text-text-primary"
                  >
                    Account
                  </Link>
                  <Link
                    to="/crop"
                    onClick={() => setMenuOpen(false)}
                    className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white text-center"
                  >
                    Open app
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setMenuOpen(false)}
                    className="rounded-lg border border-border-strong px-4 py-2.5 text-sm font-medium text-center text-text-primary"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMenuOpen(false)}
                    className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white text-center"
                  >
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

function Hero({ loggedIn, plan }: { loggedIn: boolean; plan: Plan }) {
  const primary = loggedIn
    ? { to: "/crop", label: "Open the app" }
    : { to: "/register", label: "Check a card free" };
  return (
    <section id="top" className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-[520px] w-[820px] rounded-full opacity-[0.18] blur-3xl"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, var(--color-accent), transparent 60%)",
        }}
      />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-12 pb-16 sm:pt-20 sm:pb-24 grid lg:grid-cols-2 gap-10 lg:gap-8 items-center">
        <div className="text-center lg:text-left">
          <span className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface-overlay/60 px-3 py-1 text-xs text-text-secondary">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            Card prep &amp; AI pre-grading for Pokémon &amp; TCG
          </span>
          <h1 className="mt-5 text-4xl sm:text-5xl lg:text-[3.4rem] font-semibold tracking-tight leading-[1.05]">
            Know the grade
            <br />
            <span className="text-accent">before you pay to grade.</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-text-secondary max-w-xl mx-auto lg:mx-0">
            GemCheck is a card preparation and AI grading tool. Photograph your card and
            get an honest, company-by-company grade estimate — plus exactly what's holding
            it back — so you never waste money submitting a card that won't gem.
          </p>
          <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
            <Link
              to={primary.to}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-sm font-semibold text-white hover:bg-accent-hover transition-colors shadow-lg shadow-accent/25"
            >
              <Upload className="w-4 h-4" />
              {primary.label}
            </Link>
            <a
              href="#report"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface-overlay/40 px-6 py-3.5 text-sm font-semibold text-text-primary hover:bg-surface-overlay transition-colors"
            >
              See a sample report
            </a>
          </div>
          <p className="mt-4 text-sm text-text-muted">
            {plan === "free"
              ? "You're on the free plan — 1 grade a month and 3 crops a day. Upgrade any time."
              : plan === "unlimited"
              ? "Unlimited crops and 10 grades a day active."
              : plan === "api"
              ? "API plan active — manage your keys in the app."
              : "Free to start. No card details required."}
          </p>
        </div>

        <HeroVisual />
      </div>
    </section>
  );
}

function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none">
      <div className="relative aspect-[4/5] sm:aspect-[5/5]">
        <div className="absolute inset-0 rounded-3xl border border-border-subtle bg-gradient-to-b from-surface-raised to-surface-overlay/40 overflow-hidden">
          <div className="checkerboard absolute inset-0 opacity-[0.35]" />
          <div
            aria-hidden
            className="absolute left-[8%] right-[8%] h-px bg-gradient-to-r from-transparent via-accent to-transparent shadow-[0_0_18px_2px_var(--color-accent)] animate-[scan-down_4.5s_ease-in-out_infinite]"
          />
        </div>

        <div className="absolute left-1/2 top-1/2 w-[64%] -translate-x-[58%] -translate-y-1/2 animate-[float_6s_ease-in-out_infinite]">
          <HoloCard src={AFTER_IMG} alt="A trading card cleanly prepared by GemCheck" />
        </div>

        <div className="absolute right-3 sm:right-5 bottom-5 w-[58%] max-w-[280px] rounded-2xl border border-border-subtle bg-surface-raised/95 backdrop-blur p-4 shadow-2xl animate-[float-slow_7s_ease-in-out_infinite]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-primary">Estimated grades</span>
            <span className="rounded-full bg-accent/15 text-accent text-[10px] font-semibold px-2 py-0.5">
              EXAMPLE
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {[
              ["PSA", "8"],
              ["BGS", "8.5"],
              ["CGC", "8.5"],
              ["ACE", "8.0"],
            ].map(([co, g]) => (
              <div
                key={co}
                className="rounded-lg bg-surface-overlay/70 px-2.5 py-1.5 flex items-center justify-between"
              >
                <span className="text-[11px] text-text-secondary">{co}</span>
                <span className="text-xs font-semibold text-text-primary">{g}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-snug text-text-secondary">
            <span className="text-text-muted">Main concern: </span>
            Light whitening on the rear top-left corner.
          </p>
        </div>
      </div>
    </div>
  );
}

function HoloCard({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <img
        src={src}
        alt={alt}
        className="w-full h-auto rounded-[5%] drop-shadow-[0_22px_45px_rgba(0,0,0,0.55)] select-none"
        draggable={false}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[5%] mix-blend-screen opacity-50 animate-[holo-pan_7s_linear_infinite]"
        style={{
          backgroundImage:
            "linear-gradient(115deg, transparent 30%, rgba(124,108,246,0.35) 45%, rgba(56,189,248,0.35) 55%, transparent 70%)",
          backgroundSize: "200% 100%",
        }}
      />
    </div>
  );
}

function SectionHeading({
  kicker,
  title,
  copy,
  center = true,
}: {
  kicker?: string;
  title: string;
  copy?: string;
  center?: boolean;
}) {
  return (
    <div className={`max-w-2xl ${center ? "mx-auto text-center" : ""}`}>
      {kicker && (
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-accent mb-3">
          {kicker}
        </div>
      )}
      <h2 className="text-2xl sm:text-3xl lg:text-[2.1rem] font-semibold tracking-tight">
        {title}
      </h2>
      {copy && <p className="mt-3 text-text-secondary text-base">{copy}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Why pre-check (the cost of submitting blind)                        */
/* ------------------------------------------------------------------ */

function CostStrip() {
  const items = [
    {
      icon: Wallet,
      stat: "£15–£150",
      label: "per card to grade",
      copy: "Submission, postage and insurance add up fast — before you know the result.",
    },
    {
      icon: Clock,
      stat: "Weeks to months",
      label: "of waiting",
      copy: "Turnaround is long. A low grade you could've predicted stings even more.",
    },
    {
      icon: AlertTriangle,
      stat: "No refunds",
      label: "for a low grade",
      copy: "Graders charge the same whether your card comes back a 10 or a 6.",
    },
  ];
  return (
    <section className="border-y border-border-subtle bg-surface-raised/40">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-16">
        <p className="text-center text-sm text-text-secondary max-w-2xl mx-auto">
          Grading is a gamble when you can't see what the grader sees.{" "}
          <span className="text-text-primary font-medium">GemCheck takes the guesswork out first.</span>
        </p>
        <div className="mt-8 grid sm:grid-cols-3 gap-4">
          {items.map((it) => (
            <div
              key={it.label}
              className="rounded-2xl border border-border-subtle bg-surface-raised p-5"
            >
              <span className="inline-flex w-10 h-10 rounded-xl bg-accent/15 items-center justify-center">
                <it.icon className="w-5 h-5 text-accent" />
              </span>
              <div className="mt-3 text-2xl font-semibold text-text-primary">{it.stat}</div>
              <div className="text-xs uppercase tracking-wide text-text-muted">{it.label}</div>
              <p className="mt-2 text-sm text-text-secondary">{it.copy}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Example grading report (faithful to the real /grade output)         */
/* ------------------------------------------------------------------ */

const EXAMPLE_COMPANIES = [
  { name: "PSA", likely: "8", low: "7", high: "9", gem: "Low", subs: ["8", "7.5", "8.5", "8.5"] },
  { name: "Beckett", likely: "8.5", low: "8", high: "9", gem: "Low", subs: ["8.5", "8", "9", "8.5"] },
  { name: "CGC", likely: "8.5", low: "8", high: "9", gem: "Low", subs: ["9", "8", "8.5", "8.5"] },
  { name: "ACE", likely: "8.0", low: "7.5", high: "8.5", gem: "Low", subs: ["8.5", "7.5", "8", "8.5"] },
  { name: "TAG", likely: "8.2", low: "7.6", high: "8.8", gem: "Low", subs: ["8.4", "7.8", "8.3", "8.5"] },
];

// Example figures + light "paper" components so the homepage preview matches the
// downloadable PDF report (same sections, palette and layout).
const RPT_INK = "#181b21";
const RPT_MUTE = "#6e7480";
const RPT_LINE = "#dde0e6";
const RPT_ACCENT = "#2563eb";

const EX_IDENT: [string, string][] = [
  ["Set", "Gym Heroes"],
  ["No.", "52 / 132"],
  ["Rarity", "Common"],
  ["Variant", "Non-holo"],
  ["Edition", "1st Edition"],
  ["Language", "English"],
  ["Illus.", "Kagemaru Himeno"],
];

const EX_SCORES: { label: string; score: number; verdict: string }[] = [
  { label: "Corners", score: 7.5, verdict: "Light whitening on the rear top-left corner." },
  { label: "Edges", score: 8.0, verdict: "Minor wear along the right border." },
  { label: "Surface", score: 8.5, verdict: "One faint scuff visible under glare." },
  { label: "Eye appeal", score: 8.0, verdict: "Clean, bright and well printed." },
];

function scoreColor(s: number): string {
  return s >= 8.5 ? "#10a05a" : s >= 7 ? RPT_ACCENT : "#b4780a";
}

function PaperSec({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h4 className="text-[12.5px] font-bold" style={{ color: RPT_INK }}>
        {title}
      </h4>
      <div className="mt-1.5 border-t" style={{ borderColor: RPT_LINE }} />
      <div className="mt-3">{children}</div>
    </section>
  );
}

function ScoreBar({ label, score, verdict }: { label: string; score: number; verdict: string }) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="w-20 text-[12px] font-bold shrink-0" style={{ color: RPT_INK }}>
          {label}
        </span>
        <span className="w-7 text-[12px] tabular-nums" style={{ color: RPT_INK }}>
          {score.toFixed(1)}
        </span>
        <span className="relative flex-1 h-1.5 rounded-full" style={{ backgroundColor: RPT_LINE }}>
          <span
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${(score / 10) * 100}%`, backgroundColor: scoreColor(score) }}
          />
        </span>
      </div>
      <p className="mt-1 ml-[6.5rem] text-[10.5px]" style={{ color: RPT_MUTE }}>
        {verdict}
      </p>
    </div>
  );
}

// A faux defect close-up: a zoomed region of the example card image.
function Snap({ position }: { position: string }) {
  return (
    <div
      className="w-[44px] h-[44px] rounded border shrink-0 bg-cover"
      style={{
        backgroundImage: `url(${AFTER_IMG})`,
        backgroundSize: "300%",
        backgroundPosition: position,
        borderColor: RPT_LINE,
      }}
    />
  );
}

function ReportSection() {
  return (
    <section id="report" className="relative scroll-mt-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24">
        <SectionHeading
          kicker="The pre-grade report"
          title="The exact report you'll download."
          copy="Every grade comes with a full PDF report. Here's a real example, figures and all — card ID, per-company grades and subgrades, condition breakdown, centring, value and a preparation plan."
        />

        <div className="mt-12 mx-auto max-w-3xl">
          <div className="relative rounded-lg bg-white text-[#181b21] shadow-2xl ring-1 ring-black/10 overflow-hidden">
            <div className="h-1.5" style={{ backgroundColor: RPT_ACCENT }} />
            <span
              className="absolute right-4 top-4 rounded-full text-[10px] font-semibold px-2 py-0.5"
              style={{ backgroundColor: "#eef2ff", color: RPT_ACCENT }}
            >
              EXAMPLE
            </span>

            <div className="p-6 sm:p-9">
              {/* header */}
              <h3 className="text-[19px] font-bold tracking-tight">
                Card Condition Pre-Grade Report
              </h3>
              <p className="mt-1 text-[11px]" style={{ color: RPT_MUTE }}>
                GemCheck AI Pre-Grader · 23 June 2026
              </p>
              <div className="mt-2 border-t" style={{ borderColor: RPT_LINE }} />

              {/* identity + images */}
              <div className="mt-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[15px] font-bold">Erika&apos;s Oddish</div>
                  <dl className="mt-2 space-y-0.5 text-[11.5px]" style={{ color: RPT_MUTE }}>
                    {EX_IDENT.map(([k, v]) => (
                      <div key={k} className="flex gap-1.5">
                        <dt>{k}:</dt>
                        <dd style={{ color: RPT_INK }}>{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {["1st Edition stamp", "Set symbol: Gym"].map((m) => (
                      <span
                        key={m}
                        className="rounded text-[10px] px-1.5 py-0.5"
                        style={{ backgroundColor: "#eef2ff", color: RPT_ACCENT }}
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-[10.5px]" style={{ color: RPT_MUTE }}>
                    ID confidence: high
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {["Front", "Back"].map((side) => (
                    <div key={side} className="text-center">
                      <div
                        className="w-[58px] h-[80px] rounded border bg-contain bg-no-repeat bg-center"
                        style={{
                          backgroundImage: `url(${AFTER_IMG})`,
                          borderColor: RPT_LINE,
                          backgroundColor: "#f3f4f6",
                        }}
                      />
                      <div className="mt-1 text-[9px]" style={{ color: RPT_MUTE }}>
                        {side}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* recommendation */}
              <PaperSec title="Recommendation">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[14px] font-bold">Possible — inspect first</div>
                  <span
                    className="rounded-full text-[10px] font-semibold px-2 py-0.5"
                    style={{ backgroundColor: "#eef2ff", color: RPT_ACCENT }}
                  >
                    Inspect first
                  </span>
                </div>
                <p className="mt-1 text-[11.5px]" style={{ color: RPT_INK }}>
                  Best fit: CGC or Beckett
                </p>
                <p className="mt-1 text-[11px]" style={{ color: RPT_MUTE }}>
                  Strong centring and a clean surface, but corner whitening on the back likely caps
                  a gem mint. A grader that weights centring more favourably may return a higher
                  number.
                </p>
              </PaperSec>

              {/* company table */}
              <PaperSec title="Estimated grade by company">
                <div className="grid grid-cols-[1.5fr_0.7fr_1fr_1.6fr] gap-x-2 text-[11px]">
                  {["Company", "Likely", "Range", "Subgrades (C / Co / E / S)"].map((h) => (
                    <div key={h} className="font-bold pb-1.5" style={{ color: RPT_MUTE }}>
                      {h}
                    </div>
                  ))}
                  {EXAMPLE_COMPANIES.map((c) => (
                    <div key={c.name} className="contents">
                      <div className="py-1.5 font-bold border-t" style={{ borderColor: RPT_LINE }}>
                        {c.name}
                      </div>
                      <div
                        className="py-1.5 border-t tabular-nums"
                        style={{ borderColor: RPT_LINE }}
                      >
                        {c.likely}
                      </div>
                      <div
                        className="py-1.5 border-t tabular-nums"
                        style={{ borderColor: RPT_LINE, color: RPT_MUTE }}
                      >
                        {c.low} – {c.high}
                      </div>
                      <div
                        className="py-1.5 border-t tabular-nums"
                        style={{ borderColor: RPT_LINE, color: RPT_MUTE }}
                      >
                        {c.subs.join("  /  ")}
                      </div>
                    </div>
                  ))}
                </div>
              </PaperSec>

              {/* condition breakdown */}
              <PaperSec title="Condition breakdown">
                <div className="space-y-3">
                  {EX_SCORES.map((s) => (
                    <ScoreBar key={s.label} {...s} />
                  ))}
                </div>
              </PaperSec>

              {/* centering */}
              <PaperSec title="Centering (measured)">
                <div className="grid grid-cols-2 gap-4 text-[11.5px]">
                  <div>
                    <div className="text-[10px] mb-0.5" style={{ color: RPT_MUTE }}>
                      Front
                    </div>
                    <div>55 / 45 left-right</div>
                    <div>52 / 48 top-bottom</div>
                  </div>
                  <div>
                    <div className="text-[10px] mb-0.5" style={{ color: RPT_MUTE }}>
                      Back
                    </div>
                    <div>60 / 40 left-right</div>
                    <div>54 / 46 top-bottom</div>
                  </div>
                </div>
              </PaperSec>

              {/* value */}
              <PaperSec title="Estimated value (rough)">
                <div className="text-[11.5px] space-y-0.5">
                  <div>
                    Raw / ungraded: <span className="font-semibold">£18 – £30</span>
                  </div>
                  <div style={{ color: RPT_MUTE }}>PSA · 8: £45 – £70</div>
                  <div style={{ color: RPT_MUTE }}>CGC · 8.5: £55 – £85</div>
                  <p className="mt-1 text-[10px]" style={{ color: RPT_MUTE }}>
                    Confidence: medium — based on recent comparable sales.
                  </p>
                </div>
              </PaperSec>

              {/* what limits the grade */}
              <PaperSec title="What limits the grade">
                <div className="text-[11px] space-y-2">
                  <div>
                    <div className="font-bold" style={{ color: "#c82626" }}>
                      Blocks gem mint
                    </div>
                    <ul className="mt-1 space-y-0.5" style={{ color: RPT_INK }}>
                      <li>· Rear top-left corner whitening</li>
                      <li>· Light edge wear, right border</li>
                    </ul>
                  </div>
                  <div>
                    <div className="font-bold" style={{ color: "#b4780a" }}>
                      Blocks mint (~9)
                    </div>
                    <ul className="mt-1 space-y-0.5" style={{ color: RPT_INK }}>
                      <li>· Surface scuff under glare</li>
                    </ul>
                  </div>
                </div>
              </PaperSec>

              {/* inspection notes */}
              <PaperSec title="Inspection notes">
                <div className="text-[11px]">
                  <div className="font-bold" style={{ color: RPT_INK }}>
                    Other observations
                  </div>
                  <ul className="mt-1 space-y-0.5" style={{ color: RPT_MUTE }}>
                    <li>· [minor] Print line through the lower border (likely factory)</li>
                    <li>· [note] Slight gloss difference, rear bottom edge</li>
                  </ul>
                </div>
              </PaperSec>

              {/* preparation plan */}
              <PaperSec title="Preparation plan">
                <p className="text-[11px]" style={{ color: RPT_MUTE }}>
                  Two light issues are reasonable to address on a raw card; nothing here is
                  permanent damage.
                </p>
                <div className="mt-2 text-[11px] font-bold" style={{ color: "#10a05a" }}>
                  Safe to prep (2)
                </div>
                <div className="mt-2 space-y-3">
                  {[
                    {
                      pos: "18% 14%",
                      label: "Lift surface debris",
                      meta: "Front, lower-left · low risk, easy",
                      action:
                        "A fleck of debris sits on the surface — gently lift it with a clean microfibre, no pressure.",
                    },
                    {
                      pos: "82% 30%",
                      label: "Ease light edge dust",
                      meta: "Right border · low risk, easy",
                      action:
                        "Loose dust along the right edge can be brushed off so it isn't read as wear.",
                    },
                  ].map((it) => (
                    <div key={it.label} className="flex gap-3">
                      <Snap position={it.pos} />
                      <div className="min-w-0">
                        <div className="text-[12px] font-bold" style={{ color: RPT_INK }}>
                          {it.label}
                        </div>
                        <div className="text-[10px]" style={{ color: "#b4780a" }}>
                          {it.meta}
                        </div>
                        <p className="mt-0.5 text-[10.5px]" style={{ color: RPT_INK }}>
                          {it.action}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </PaperSec>

              {/* summary */}
              <PaperSec title="Summary">
                <p className="text-[11.5px]" style={{ color: RPT_INK }}>
                  A solid NM-MT example. Submit to a centring-friendly grader for the best shot at a
                  9; otherwise it sells well raw.
                </p>
              </PaperSec>

              <div className="mt-5 border-t pt-3" style={{ borderColor: RPT_LINE }}>
                <p className="text-[9.5px]" style={{ color: RPT_MUTE }}>
                  Not an official grade from PSA, Beckett, CGC, TAG, ACE or any grader. A pre-check
                  estimate from photos to help you decide whether to submit, sell raw, or inspect
                  further. Any values shown are rough AI estimates, not live market prices.
                </p>
                <p className="mt-2 text-[9px]" style={{ color: RPT_MUTE }}>
                  GemCheck pre-grade report · page 1 of 1
                </p>
              </div>
            </div>
          </div>

          <p className="mt-4 text-center text-xs text-text-muted">
            Every grade includes this as a downloadable PDF, with close-up snapshots of any flaws.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Prepare your card (clean scans + fix what's fixable)                */
/* ------------------------------------------------------------------ */

function PrepareSection() {
  const prep = [
    "Spot light foil scrapes and surface marks worth easing",
    "Flatten gentle curl so centring reads true",
    "Lift loose surface debris before it scores as a flaw",
    "Sleeve and store right so it doesn't pick up new wear",
  ];
  return (
    <section
      id="prepare"
      className="relative scroll-mt-20 border-y border-border-subtle bg-surface-raised/40"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24">
        <SectionHeading
          kicker="Card preparation"
          title="Prep the card. Lift the grade."
          copy="GemCheck doesn't just score your card — it shows you what's holding the grade back and which light defects are worth carefully addressing before you submit, with a snapshot of the exact spot."
        />

        <div className="mt-12 grid lg:grid-cols-2 gap-10 items-center">
          {/* clean scan visual */}
          <div>
            <BeforeAfter />
            <p className="mt-3 text-center text-xs text-text-muted">
              Start with a clean scan — GemCheck detects, de-skews and lifts the card off its
              background at full resolution, so the inspection sees every detail.
            </p>
          </div>

          {/* prep checklist */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface-raised px-3 py-1 text-xs text-text-secondary">
              <Wrench className="w-3.5 h-3.5 text-accent" />
              Preparation plan
            </div>
            <h3 className="mt-4 text-xl font-semibold tracking-tight">
              A clear, honest to-do list — not false promises.
            </h3>
            <p className="mt-2 text-sm text-text-secondary">
              We flag only what's reasonable to improve on a raw card, and we're upfront about
              what's permanent. No cleaning trick turns a creased card into a gem.
            </p>
            <ul className="mt-5 space-y-3">
              {prep.map((p) => (
                <li
                  key={p}
                  className="flex items-start gap-3 rounded-xl border border-border-subtle bg-surface-raised px-4 py-3.5"
                >
                  <span className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4 text-accent" />
                  </span>
                  <span className="text-sm text-text-primary">{p}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 flex items-start gap-2 text-xs text-text-muted">
              <ShieldCheck className="w-4 h-4 text-accent mt-0.5 shrink-0" />
              Take care with valuable cards — improper cleaning can lower a grade. When in doubt,
              leave it and let the grader decide.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* Draggable before/after using the real photo and the real cropped result. */
function BeforeAfter() {
  const [pos, setPos] = useState(50);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const setFromClientX = (clientX: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(4, Math.min(96, pct)));
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (dragging.current) setFromClientX(e.clientX);
    };
    const up = () => (dragging.current = false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className="relative aspect-[3/2] w-full rounded-2xl overflow-hidden border border-border-subtle select-none cursor-ew-resize touch-none bg-surface-overlay"
      onPointerDown={(e) => {
        dragging.current = true;
        setFromClientX(e.clientX);
      }}
    >
      {/* BEFORE — the real desk photo */}
      <div className="absolute inset-0">
        <img
          src={BEFORE_IMG}
          alt="A real card photographed on a desk"
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <span className="absolute left-3 top-3 rounded-md bg-black/55 px-2 py-1 text-[11px] font-medium text-white/90">
          Your photo
        </span>
      </div>

      {/* AFTER — the clean crop on a studio backdrop, clipped by the slider */}
      <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 120% at 60% 30%, #20232f 0%, #14161f 60%, #0d0f16 100%)",
          }}
        />
        <div className="checkerboard absolute inset-0 opacity-[0.25]" />
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <img
            src={AFTER_IMG}
            alt="The same card cleanly cropped and straightened"
            draggable={false}
            className="max-h-full max-w-full rounded-[3%] drop-shadow-[0_18px_38px_rgba(0,0,0,0.55)]"
          />
        </div>
        <span className="absolute right-3 top-3 rounded-md bg-accent/85 px-2 py-1 text-[11px] font-semibold text-white">
          Ready to grade
        </span>
      </div>

      <div className="absolute top-0 bottom-0 w-px bg-white/70" style={{ left: `${pos}%` }}>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white text-surface flex items-center justify-center shadow-xl">
          <MoveHorizontal className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Compare grading companies                                           */
/* ------------------------------------------------------------------ */

function CompareSection() {
  const graders = [
    { name: "PSA", grade: "8", note: "Whole grades, no subgrades" },
    { name: "Beckett", grade: "8.5", note: "Half grades + subgrades" },
    { name: "CGC", grade: "8.5", note: "Half grades + subgrades" },
    { name: "ACE", grade: "8.0", note: "One-decimal grades" },
    { name: "TAG", grade: "8.2", note: "Algorithmic, 1-1000 scale" },
  ];
  return (
    <section id="compare" className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24 scroll-mt-20">
      <SectionHeading
        kicker="Compare grading companies"
        title="One card. Five grading standards."
        copy="Each company weights centring, corners, edges and surface differently. GemCheck estimates them all so you can send your card where it scores best."
      />
      <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {graders.map((g) => (
          <div
            key={g.name}
            className="group relative rounded-2xl border border-border-subtle bg-surface-raised p-5 overflow-hidden hover:border-accent/40 transition-colors"
          >
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-1 opacity-70"
              style={{
                background:
                  "linear-gradient(90deg, var(--color-accent), #38bdf8, var(--color-accent))",
              }}
            />
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold">{g.name}</span>
              <Scale className="w-4 h-4 text-text-muted" />
            </div>
            <div className="mt-4">
              <div className="text-[11px] uppercase tracking-wide text-text-muted">
                Estimated
              </div>
              <div className="text-3xl font-semibold text-text-primary">{g.grade}</div>
            </div>
            <div className="mt-3 text-xs text-text-secondary">{g.note}</div>
          </div>
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-text-muted">
        Example estimates. GemCheck is independent and not affiliated with any grading company.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* How it works                                                        */
/* ------------------------------------------------------------------ */

function HowItWorks() {
  const steps = [
    { icon: Camera, title: "Photograph", copy: "Snap the front and back, flat and in sharp focus." },
    { icon: ScanSearch, title: "Pre-grade", copy: "AI inspects centring, corners, edges and surface." },
    { icon: Wrench, title: "Prepare", copy: "See what's fixable and clean it up to lift the grade." },
    { icon: Scale, title: "Decide", copy: "Submit to the best-fit grader — or sell it raw." },
  ];
  return (
    <section id="how" className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24 scroll-mt-20">
      <SectionHeading kicker="How it works" title="From photo to confident decision." />
      <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {steps.map((s, i) => (
          <div key={s.title} className="relative rounded-2xl border border-border-subtle bg-surface-raised p-5">
            <span className="text-5xl font-bold text-surface-overlay absolute top-3 right-4 select-none">
              {i + 1}
            </span>
            <span className="inline-flex w-10 h-10 rounded-xl bg-accent/15 items-center justify-center">
              <s.icon className="w-5 h-5 text-accent" />
            </span>
            <h3 className="mt-4 text-base font-semibold">{s.title}</h3>
            <p className="mt-1.5 text-sm text-text-secondary">{s.copy}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Developers / API                                                    */
/* ------------------------------------------------------------------ */

const API_SNIPPET = `curl -X POST https://gemcheck.co.uk/v1/crop \\
  -H "Authorization: Bearer $GEMCHECK_API_KEY" \\
  -H "Accept: image/png" \\
  -F "image=@charizard.jpg" \\
  -o cropped.png

curl -X POST https://gemcheck.co.uk/v1/grade \\
  -H "Authorization: Bearer $GEMCHECK_API_KEY" \\
  -F "front=@front.jpg" -F "back=@back.jpg"`;

function ApiSection({ plan, loggedIn }: { plan: Plan; loggedIn: boolean }) {
  const endpoints = [
    ["POST", "/v1/crop", "Crop & straighten a card"],
    ["POST", "/v1/grade", "AI pre-grade report (multipart photos)"],
    ["GET", "/v1/grade/quota", "Grading allowance"],
    ["GET", "/v1/account", "Plan + quota snapshot"],
    ["GET", "/v1/usage", "API usage history"],
    ["GET", "/v1/openapi.json", "OpenAPI 3.1 spec"],
  ];

  let cta: { label: string; action: () => void };
  if (plan === "api") {
    cta = { label: "Manage your API keys", action: () => (window.location.href = "/account") };
  } else if (loggedIn) {
    cta = { label: "Upgrade to API — £19.99/mo", action: () => goCheckout("api") };
  } else {
    cta = { label: "Create an account", action: () => (window.location.href = "/register") };
  }

  return (
    <section id="api" className="relative scroll-mt-20 border-y border-border-subtle bg-surface-raised/40">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24">
        <SectionHeading
          kicker="For developers &amp; shops"
          title="Automate prep with the API."
          copy="Bulk-process listings, run AI pre-grades, or wire GemCheck into your shop. Crop and grade with the same engine as the web app."
        />
        <div className="mt-12 grid lg:grid-cols-2 gap-8 items-start">
          <div className="rounded-2xl border border-border-subtle bg-[#0e1018] overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-2.5">
              <Terminal className="w-4 h-4 text-accent" />
              <span className="text-xs font-medium text-text-secondary">Terminal</span>
            </div>
            <pre className="overflow-x-auto px-4 py-4 text-[12.5px] leading-relaxed text-text-secondary">
              <code className="whitespace-pre">{API_SNIPPET}</code>
            </pre>
            <div className="border-t border-border-subtle px-4 py-3 text-[12px] text-text-muted">
              Or send <code className="text-text-secondary">image_url</code> /{" "}
              <code className="text-text-secondary">image_base64</code> as JSON. Returns{" "}
              <code className="text-text-secondary">{"{ image_base64, metadata }"}</code> by
              default.
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid sm:grid-cols-3 gap-3">
              {[
                { icon: KeyRound, t: "Key auth", c: "Bearer tokens; rate limits per account" },
                { icon: Zap, t: "Crop + grade", c: "Same pipeline as the web app" },
                { icon: ShieldCheck, t: "Safe URLs", c: "SSRF-guarded image fetch" },
              ].map((f) => (
                <div key={f.t} className="rounded-xl border border-border-subtle bg-surface-raised p-4">
                  <f.icon className="w-5 h-5 text-accent" />
                  <div className="mt-2 text-sm font-semibold">{f.t}</div>
                  <div className="text-xs text-text-secondary mt-0.5">{f.c}</div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-border-subtle bg-surface-raised overflow-hidden">
              {endpoints.map(([method, path, desc]) => (
                <div
                  key={path}
                  className="flex items-center gap-3 border-b border-border-subtle last:border-0 px-4 py-3"
                >
                  <span className="text-[10px] font-bold text-accent w-10 shrink-0">{method}</span>
                  <code className="text-xs text-text-primary shrink-0">{path}</code>
                  <span className="text-xs text-text-muted truncate">{desc}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3 pt-1">
              <button
                onClick={cta.action}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white hover:bg-accent-hover transition-colors shadow-lg shadow-accent/25"
              >
                {cta.label}
                <ArrowRight className="w-4 h-4" />
              </button>
              <Link
                to="/docs"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface-overlay/40 px-5 py-3 text-sm font-semibold text-text-primary hover:bg-surface-overlay transition-colors"
              >
                Read the API docs
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Tier-aware plan CTA                                                 */
/* ------------------------------------------------------------------ */

function PlanCta({ loggedIn, plan }: { loggedIn: boolean; plan: Plan }) {
  let title: string;
  let copy: string;
  let primary: { label: string; onClick?: () => void; to?: string };
  let secondary: { label: string; to: string } | null = { label: "See full pricing", to: "/pricing" };

  if (!loggedIn) {
    title = "Check a card before you ever pay to grade.";
    copy = "Free to start — 1 grade a month and 3 crops a day. No card details to sign up.";
    primary = { label: "Create a free account", to: "/register" };
  } else if (plan === "free") {
    title = "Grade more, gamble less — £7.99/mo.";
    copy = "Unlimited crops and up to 10 grading reports a day, no daily crop cap.";
    primary = { label: "Upgrade to Unlimited", onClick: () => goCheckout("unlimited") };
  } else if (plan === "unlimited") {
    title = "Add API access for £19.99/mo.";
    copy = "Everything in Unlimited, plus programmatic cropping for automation and bulk work.";
    primary = { label: "Upgrade to API", onClick: () => goCheckout("api") };
    secondary = { label: "View the API docs", to: "/docs" };
  } else {
    title = "You're on the API plan.";
    copy = "Manage your keys and usage, or jump straight into the app.";
    primary = { label: "Open the app", to: "/crop" };
    secondary = { label: "Manage API keys", to: "/account" };
  }

  return (
    <section className="relative overflow-hidden border-t border-border-subtle">
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[420px] w-[760px] rounded-full opacity-[0.16] blur-3xl"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, var(--color-accent), transparent 60%)",
        }}
      />
      <div className="relative mx-auto max-w-4xl px-4 sm:px-6 py-20 sm:py-28 text-center">
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-4 text-text-secondary max-w-xl mx-auto">{copy}</p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          {primary.to ? (
            <Link
              to={primary.to}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-7 py-3.5 text-sm font-semibold text-white hover:bg-accent-hover transition-colors shadow-lg shadow-accent/25"
            >
              {primary.label}
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <button
              onClick={primary.onClick}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-7 py-3.5 text-sm font-semibold text-white hover:bg-accent-hover transition-colors shadow-lg shadow-accent/25"
            >
              {primary.label}
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
          {secondary && (
            <Link
              to={secondary.to}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface-overlay/40 px-7 py-3.5 text-sm font-semibold text-text-primary hover:bg-surface-overlay transition-colors"
            >
              {secondary.label}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Honest & useful                                                     */
/* ------------------------------------------------------------------ */

function HonestSection() {
  return (
    <section className="mx-auto max-w-3xl px-4 sm:px-6 pb-16 sm:pb-24">
      <div className="rounded-2xl border border-border-subtle bg-surface-raised p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <span className="inline-flex w-11 h-11 rounded-xl bg-accent/15 items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-accent" />
          </span>
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
            Honest guidance before you submit.
          </h2>
        </div>
        <div className="mt-4 grid sm:grid-cols-2 gap-3">
          <div className="flex items-start gap-2 text-sm text-text-secondary">
            <CheckCircle2 className="w-4 h-4 text-accent mt-0.5 shrink-0" />
            Estimates are based on what your photos can show.
          </div>
          <div className="flex items-start gap-2 text-sm text-text-secondary">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            Fine scratches or dents hidden by glare may not be visible.
          </div>
        </div>
        <p className="mt-4 text-sm text-text-muted">
          GemCheck is a pre-check, not an official grade. Official grades are decided by the
          grading company after inspecting the physical card. For high-value cards, always
          inspect by hand too.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Footer                                                              */
/* ------------------------------------------------------------------ */

function SiteFooter() {
  return (
    <footer className="border-t border-border-subtle">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <Wordmark className="h-9" />
        <div className="flex items-center gap-5 text-sm">
          <Link to="/pricing" className="text-text-secondary hover:text-text-primary transition-colors">
            Pricing
          </Link>
          <Link to="/docs" className="text-text-secondary hover:text-text-primary transition-colors">
            API docs
          </Link>
          <Link to="/login" className="text-text-secondary hover:text-text-primary transition-colors">
            Sign in
          </Link>
          <a
            href="https://getlooky.uk"
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            A Looky Collectibles tool
          </a>
        </div>
      </div>
    </footer>
  );
}
