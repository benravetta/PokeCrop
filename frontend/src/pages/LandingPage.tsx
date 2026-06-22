import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Crop,
  Upload,
  ArrowRight,
  Camera,
  Wand2,
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
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useMe } from "../hooks/useMe";
import { startCheckout } from "../lib/api";

const BEFORE_IMG = "/demo-before.jpg?v=oddish3";
const AFTER_IMG = "/demo-after.png?v=oddish3";

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
  { label: "Crop", href: "#crop" },
  { label: "Grading report", href: "#report" },
  { label: "Compare graders", href: "#compare" },
  { label: "Developers", href: "#api" },
];

export function LandingPage() {
  const { loggedIn, plan } = useViewer();
  return (
    <div className="min-h-[100dvh] bg-surface text-text-primary">
      <TopNav loggedIn={loggedIn} plan={plan} />
      <Hero loggedIn={loggedIn} plan={plan} />
      <CropSection />
      <ReportSection />
      <CompareSection />
      <ApiSection plan={plan} loggedIn={loggedIn} />
      <HowItWorks />
      <PlanCta loggedIn={loggedIn} plan={plan} />
      <HonestSection />
      <SiteFooter />
    </div>
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
        <a href="#top" className="flex items-center gap-2.5 shrink-0">
          <span className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center">
            <Crop className="w-[18px] h-[18px] text-accent" />
          </span>
          <span className="text-[17px] font-semibold tracking-tight">CardCrop</span>
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
                Create free account
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
    : { to: "/register", label: "Create a free account" };
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
            Built for Pokémon &amp; TCG collectors
          </span>
          <h1 className="mt-5 text-4xl sm:text-5xl lg:text-[3.4rem] font-semibold tracking-tight leading-[1.05]">
            Perfect card scans.
            <br />
            <span className="text-accent">Pro-level grade estimates.</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-text-secondary max-w-xl mx-auto lg:mx-0">
            Turn a quick phone photo into a clean, straightened card image — then get a
            detailed condition report with estimated grades from PSA, Beckett, CGC, ACE
            and TAG before you spend a penny on submission.
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
              See a real report
            </a>
          </div>
          <p className="mt-4 text-sm text-text-muted">
            {plan === "free"
              ? "You're on the free plan — 3 crops a day. Upgrade any time."
              : plan === "unlimited"
              ? "Unlimited crops active. Add API access for automation."
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
          <HoloCard src={AFTER_IMG} alt="A real trading card, cleanly cropped by CardCrop" />
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
/* From photo to clean card (real before/after)                        */
/* ------------------------------------------------------------------ */

function CropSection() {
  const points = [
    "Automatic card detection",
    "Perspective de-skew from a phone photo",
    "Transparent PNG, clean borders",
    "Front and back, ready to download",
  ];
  return (
    <section id="crop" className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24 scroll-mt-20">
      <SectionHeading
        kicker="From photo to clean card"
        title="A real photo in. A clean card out."
        copy="Drag the slider — this is an actual card photographed on a desk, cropped and straightened by CardCrop. No manual editing."
      />
      <div className="mt-12 grid lg:grid-cols-2 gap-10 items-center">
        <BeforeAfter />
        <ul className="grid sm:grid-cols-2 gap-3">
          {points.map((p) => (
            <li
              key={p}
              className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface-raised px-4 py-3.5"
            >
              <span className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center shrink-0">
                <Check className="w-4 h-4 text-accent" />
              </span>
              <span className="text-sm text-text-primary">{p}</span>
            </li>
          ))}
        </ul>
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
          Before
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
          After
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
/* Example grading report (faithful to the real /grade output)         */
/* ------------------------------------------------------------------ */

const EXAMPLE_COMPANIES = [
  { name: "PSA", likely: "8", low: "7", high: "9", gem: "Low", subs: ["8", "7.5", "8.5", "8.5"] },
  { name: "Beckett", likely: "8.5", low: "8", high: "9", gem: "Low", subs: ["8.5", "8", "9", "8.5"] },
  { name: "CGC", likely: "8.5", low: "8", high: "9", gem: "Low", subs: ["9", "8", "8.5", "8.5"] },
  { name: "ACE", likely: "8.0", low: "7.5", high: "8.5", gem: "Low", subs: ["8.5", "7.5", "8", "8.5"] },
  { name: "TAG", likely: "8.2", low: "7.6", high: "8.8", gem: "Low", subs: ["8.4", "7.8", "8.3", "8.5"] },
];

function ExampleScore({ label, grade, note }: { label: string; grade: string; note: string }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-raised p-4">
      <div className="text-xs uppercase tracking-wide text-text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-text-primary">{grade}</div>
      <div className="mt-1 text-xs text-text-secondary">{note}</div>
    </div>
  );
}

function ExampleCompany({
  c,
}: {
  c: (typeof EXAMPLE_COMPANIES)[number];
}) {
  const subLabels = ["cent", "corn", "edge", "surf"];
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-raised p-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-text-primary">{c.name}</span>
        <span className="text-[11px] text-text-muted">Gem: {c.gem}</span>
      </div>
      <div className="mt-1 text-2xl font-semibold text-text-primary">{c.likely}</div>
      <div className="text-xs text-text-secondary mt-0.5">
        Range {c.low} – {c.high}
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1 text-center">
        {c.subs.map((s, i) => (
          <div key={subLabels[i]}>
            <div className="text-[10px] uppercase tracking-wide text-text-muted">
              {subLabels[i]}
            </div>
            <div className="text-xs text-text-primary">{s}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BlockerCol({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "red" | "amber" | "muted";
  items: string[];
}) {
  const toneCls =
    tone === "red"
      ? "text-red-300"
      : tone === "amber"
      ? "text-amber-300"
      : "text-text-secondary";
  const dot =
    tone === "red" ? "bg-red-400" : tone === "amber" ? "bg-amber-400" : "bg-text-muted";
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-raised p-4">
      <h4 className={`text-sm font-medium ${toneCls} mb-2`}>{title}</h4>
      {items.length ? (
        <ul className="space-y-1.5">
          {items.map((it) => (
            <li key={it} className="flex items-start gap-2 text-sm text-text-secondary">
              <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${dot}`} />
              {it}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-text-muted">None spotted in these photos.</p>
      )}
    </div>
  );
}

function ReportSection() {
  return (
    <section
      id="report"
      className="relative scroll-mt-20 border-y border-border-subtle bg-surface-raised/40"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24">
        <SectionHeading
          kicker="The grading report"
          title="Exactly what you'll see after a scan."
          copy="This is the real report layout. A two-pass AI inspection checks centring, corners, edges and surface, then estimates a grade for every major company."
        />

        <div className="mt-12 grid lg:grid-cols-[300px_1fr] gap-8 items-start">
          {/* graded card with condition markers */}
          <div className="lg:sticky lg:top-24">
            <div className="relative rounded-2xl border border-border-subtle bg-surface-raised p-4">
              <div className="relative">
                <HoloCard src={AFTER_IMG} alt="Graded example card" />
                {[
                  { top: "10%", left: "12%", n: 1 },
                  { top: "30%", left: "90%", n: 2 },
                  { top: "82%", left: "20%", n: 3 },
                ].map((m) => (
                  <span
                    key={m.n}
                    className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 rounded-full bg-accent text-white text-[11px] font-bold ring-4 ring-accent/25 shadow-lg"
                    style={{ top: m.top, left: m.left }}
                  >
                    {m.n}
                  </span>
                ))}
              </div>
              <div className="mt-4 space-y-2 text-xs text-text-secondary">
                <div className="flex gap-2">
                  <span className="font-semibold text-accent">1</span> Rear top-left corner
                  whitening
                </div>
                <div className="flex gap-2">
                  <span className="font-semibold text-accent">2</span> Light edge wear, right
                  border
                </div>
                <div className="flex gap-2">
                  <span className="font-semibold text-accent">3</span> Minor surface scuff under
                  glare
                </div>
              </div>
              <p className="mt-3 text-[11px] text-text-muted">
                Example report for illustration.
              </p>
            </div>
          </div>

          {/* the report body */}
          <div className="space-y-5">
            {/* recommendation */}
            <div className="rounded-xl border border-border-subtle bg-surface-raised p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-text-muted">
                    Recommendation
                  </div>
                  <div className="text-2xl font-semibold text-text-primary mt-1">
                    Possible — inspect first
                  </div>
                  <div className="text-sm text-text-secondary mt-1">
                    Best fit: <span className="text-text-primary">CGC or Beckett</span>
                  </div>
                </div>
                <span className="rounded-full border px-3 py-1.5 text-sm font-medium bg-accent/15 text-accent border-accent/30">
                  Inspect first
                </span>
              </div>
              <p className="mt-3 text-sm text-text-secondary">
                Strong centring and clean surface, but corner whitening on the back likely caps
                a gem mint. A grader that weights centring more favourably may return a higher
                number.
              </p>
            </div>

            {/* company estimates */}
            <div>
              <h3 className="text-xs uppercase tracking-wide text-text-muted mb-2">
                Estimated grade by company
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {EXAMPLE_COMPANIES.map((c) => (
                  <ExampleCompany key={c.name} c={c} />
                ))}
              </div>
            </div>

            {/* sub scores */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <ExampleScore label="Corners" grade="7.5" note="Rear corner whitening" />
              <ExampleScore label="Edges" grade="8.0" note="Light wear, right side" />
              <ExampleScore label="Surface" grade="8.5" note="One minor scuff" />
              <ExampleScore label="Eye appeal" grade="8.0" note="Clean, vibrant holo" />
            </div>

            {/* blockers */}
            <div className="grid md:grid-cols-3 gap-3">
              <BlockerCol
                title="Blocks gem mint"
                tone="red"
                items={["Rear top-left corner whitening", "Right edge wear"]}
              />
              <BlockerCol title="Blocks mint (≈9)" tone="amber" items={["Surface scuff under glare"]} />
              <BlockerCol title="Blocks near-mint (≈8)" tone="muted" items={[]} />
            </div>

            {/* centring */}
            <div className="rounded-xl border border-border-subtle bg-surface-raised p-5">
              <h3 className="text-sm font-medium text-text-primary mb-3">Centring</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-text-muted text-xs mb-1">Front</div>
                  <div className="text-text-primary">55 / 45 left-right</div>
                  <div className="text-text-primary">52 / 48 top-bottom</div>
                </div>
                <div>
                  <div className="text-text-muted text-xs mb-1">Back</div>
                  <div className="text-text-primary">60 / 40 left-right</div>
                  <div className="text-text-primary">54 / 46 top-bottom</div>
                </div>
              </div>
            </div>

            <p className="text-sm text-text-secondary border-l-2 border-accent/40 pl-4">
              A solid NM-MT example. Submit to a centring-friendly grader for the best shot at a
              9; otherwise it sells well raw.
            </p>
            <p className="text-xs text-text-muted">
              Estimates are based only on what's visible in your photographs. Official grades are
              decided by the grading company after inspecting the physical card.
            </p>
          </div>
        </div>
      </div>
    </section>
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
        copy="Each company weights centring, corners, edges and surface differently. CardCrop estimates them all so you can pick where to send."
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
        Example estimates. CardCrop is independent and not affiliated with any grading company.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Developers / API                                                    */
/* ------------------------------------------------------------------ */

const API_SNIPPET = `curl -X POST https://cardcrop.uk/v1/crop \\
  -H "Authorization: Bearer $CARDCROP_API_KEY" \\
  -H "Accept: image/png" \\
  -F "image=@charizard.jpg" \\
  -o cropped.png`;

function ApiSection({ plan, loggedIn }: { plan: Plan; loggedIn: boolean }) {
  const endpoints = [
    ["POST", "/v1/crop", "Crop & straighten a card from an image"],
    ["GET", "/v1/crop/limits", "Current rate-limit window + daily usage"],
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
          title="Automate cropping with the API."
          copy="Bulk-process listings, build a scanner, or wire CardCrop into your store. One authenticated POST returns a clean, transparent PNG."
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
                { icon: KeyRound, t: "Key auth", c: "Bearer tokens, per-key rate limits" },
                { icon: Zap, t: "Fast", c: "~200–500ms per card" },
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
/* How it works                                                        */
/* ------------------------------------------------------------------ */

function HowItWorks() {
  const steps = [
    { icon: Camera, title: "Take a photo", copy: "Snap the front and back in decent light." },
    { icon: Wand2, title: "Clean it up", copy: "CardCrop detects, de-skews and extracts the card." },
    { icon: ScanSearch, title: "Get the report", copy: "Centring, corners, edges and surface, inspected." },
    { icon: Scale, title: "Compare & decide", copy: "Review estimated grades and pick where to submit." },
  ];
  return (
    <section id="how" className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24 scroll-mt-20">
      <SectionHeading kicker="How it works" title="Four simple steps." />
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
/* Tier-aware plan CTA                                                 */
/* ------------------------------------------------------------------ */

function PlanCta({ loggedIn, plan }: { loggedIn: boolean; plan: Plan }) {
  let title: string;
  let copy: string;
  let primary: { label: string; onClick?: () => void; to?: string };
  let secondary: { label: string; to: string } | null = { label: "See full pricing", to: "/pricing" };

  if (!loggedIn) {
    title = "Start free. Upgrade when you're ready.";
    copy = "3 crops a day on the house. No card details to sign up.";
    primary = { label: "Create a free account", to: "/register" };
  } else if (plan === "free") {
    title = "Go unlimited for £7.99/mo.";
    copy = "Unlimited crops and grading reports, no daily cap.";
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
          Official grades are decided by the grading company after inspecting the physical card.
          For high-value cards, always inspect by hand too.
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
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center">
            <Crop className="w-4 h-4 text-accent" />
          </span>
          <span className="text-sm font-semibold">CardCrop</span>
          <span className="text-xs text-text-muted">· cardcrop.uk</span>
        </div>
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
