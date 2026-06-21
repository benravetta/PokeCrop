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
  Tag,
  ShieldCheck,
  Layers,
  FolderOpen,
  Sparkles,
  MoveHorizontal,
} from "lucide-react";

const HERO_CARD = "/card-hero.png";
const ALT_CARD = "/card-alt.png";

const NAV_LINKS = [
  { label: "Crop Cards", href: "#crop" },
  { label: "Check Condition", href: "#condition" },
  { label: "Compare Graders", href: "#compare" },
  { label: "How It Works", href: "#how" },
];

export function LandingPage() {
  return (
    <div className="min-h-[100dvh] bg-surface text-text-primary">
      <TopNav />
      <Hero />
      <CropSection />
      <ConditionSection />
      <CompareSection />
      <WhySection />
      <HowItWorks />
      <HonestSection />
      <FinalCta />
      <SiteFooter />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

function TopNav() {
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
          <Link
            to="/login"
            className="px-3 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            Sign In
          </Link>
          <Link
            to="/crop"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20"
          >
            <Upload className="w-4 h-4" />
            Upload a Card
          </Link>
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
              <Link
                to="/login"
                onClick={() => setMenuOpen(false)}
                className="rounded-lg border border-border-strong px-4 py-2.5 text-sm font-medium text-center text-text-primary"
              >
                Sign In
              </Link>
              <Link
                to="/crop"
                onClick={() => setMenuOpen(false)}
                className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white text-center"
              >
                Upload a Card
              </Link>
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

function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      {/* soft ambient glow, kept restrained */}
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
            Made for trading card collectors
          </span>
          <h1 className="mt-5 text-4xl sm:text-5xl lg:text-[3.4rem] font-semibold tracking-tight leading-[1.05]">
            Better card images.
            <br />
            <span className="text-accent">Smarter grading decisions.</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-text-secondary max-w-xl mx-auto lg:mx-0">
            Turn ordinary card photos into clean, straight images, then check the
            condition and compare estimated grades before deciding where to submit.
          </p>
          <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
            <Link
              to="/crop"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-sm font-semibold text-white hover:bg-accent-hover transition-colors shadow-lg shadow-accent/25"
            >
              <Upload className="w-4 h-4" />
              Upload a card
            </Link>
            <a
              href="#crop"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface-overlay/40 px-6 py-3.5 text-sm font-semibold text-text-primary hover:bg-surface-overlay transition-colors"
            >
              See an example
            </a>
          </div>
          <p className="mt-4 text-sm text-text-muted">Crop, inspect and compare in minutes.</p>
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
        {/* framed stage */}
        <div className="absolute inset-0 rounded-3xl border border-border-subtle bg-gradient-to-b from-surface-raised to-surface-overlay/40 overflow-hidden">
          <div className="checkerboard absolute inset-0 opacity-[0.35]" />
          {/* scan line suggesting the card being read & straightened */}
          <div
            aria-hidden
            className="absolute left-[8%] right-[8%] h-px bg-gradient-to-r from-transparent via-accent to-transparent shadow-[0_0_18px_2px_var(--color-accent)] animate-[scan-down_4.5s_ease-in-out_infinite]"
          />
        </div>

        {/* the clean card */}
        <div className="absolute left-1/2 top-1/2 w-[52%] -translate-x-[58%] -translate-y-1/2 animate-[float_6s_ease-in-out_infinite]">
          <HoloCard src={HERO_CARD} alt="Example trading card, cleanly cropped" />
        </div>

        {/* floating example condition + grades card */}
        <div className="absolute right-3 sm:right-5 bottom-5 w-[58%] max-w-[280px] rounded-2xl border border-border-subtle bg-surface-raised/95 backdrop-blur p-4 shadow-2xl animate-[float-slow_7s_ease-in-out_infinite]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-primary">Condition report</span>
            <span className="rounded-full bg-accent/15 text-accent text-[10px] font-semibold px-2 py-0.5">
              EXAMPLE
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {[
              ["PSA", "8–9"],
              ["ACE", "9"],
              ["CGC", "8.5–9"],
              ["Beckett", "8.5"],
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
            Small amount of whitening on the rear top-left corner.
          </p>
        </div>
      </div>
    </div>
  );
}

/* A card image with a tasteful holographic sheen sweep. */
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
        className="w-full h-auto rounded-[7%] drop-shadow-[0_22px_45px_rgba(0,0,0,0.55)] select-none"
        draggable={false}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[7%] mix-blend-screen opacity-50 animate-[holo-pan_7s_linear_infinite]"
        style={{
          backgroundImage:
            "linear-gradient(115deg, transparent 30%, rgba(124,108,246,0.35) 45%, rgba(56,189,248,0.35) 55%, transparent 70%)",
          backgroundSize: "200% 100%",
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* From photo to clean card                                            */
/* ------------------------------------------------------------------ */

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

function CropSection() {
  const points = [
    "Automatic card detection",
    "Straightened perspective",
    "Clean, consistent images",
    "Ready to download",
  ];
  return (
    <section id="crop" className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24 scroll-mt-20">
      <SectionHeading
        kicker="From photo to clean card"
        title="Clean card images without the fiddly editing."
        copy="Upload a normal photo and CardCrop finds the card, straightens it and creates a clean image ready for selling, sharing, cataloguing or grading."
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

/* Draggable before/after. "Before" shows the same card skewed on a desk;
   "after" shows it straightened on a clean studio background. */
function BeforeAfter() {
  const [pos, setPos] = useState(52);
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
      className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden border border-border-subtle select-none cursor-ew-resize touch-none"
      onPointerDown={(e) => {
        dragging.current = true;
        setFromClientX(e.clientX);
      }}
    >
      {/* BEFORE — casual desk photo */}
      <div className="absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 120% at 30% 20%, #3a2f25 0%, #241d17 45%, #15110d 100%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "repeating-linear-gradient(96deg, rgba(0,0,0,0.25) 0px, rgba(0,0,0,0.25) 2px, transparent 2px, transparent 26px)",
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center [perspective:900px]">
          <img
            src={HERO_CARD}
            alt="Card photographed casually on a desk"
            draggable={false}
            className="w-[58%] rounded-[6%] drop-shadow-[0_30px_40px_rgba(0,0,0,0.6)]"
            style={{ transform: "rotateX(14deg) rotateZ(-9deg) translateY(4%)" }}
          />
        </div>
        <span className="absolute left-3 top-3 rounded-md bg-black/55 px-2 py-1 text-[11px] font-medium text-white/90">
          Before
        </span>
      </div>

      {/* AFTER — clean studio crop, clipped by the slider */}
      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 0 0 ${pos}%)` }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 120% at 60% 30%, #20232f 0%, #14161f 60%, #0d0f16 100%)",
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src={HERO_CARD}
            alt="Same card cleanly cropped and straightened"
            draggable={false}
            className="w-[50%] rounded-[6%] drop-shadow-[0_18px_38px_rgba(0,0,0,0.55)]"
          />
        </div>
        <span className="absolute right-3 top-3 rounded-md bg-accent/85 px-2 py-1 text-[11px] font-semibold text-white">
          After
        </span>
      </div>

      {/* handle */}
      <div
        className="absolute top-0 bottom-0 w-px bg-white/70"
        style={{ left: `${pos}%` }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white text-surface flex items-center justify-center shadow-xl">
          <MoveHorizontal className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Check the condition                                                 */
/* ------------------------------------------------------------------ */

function ConditionSection() {
  const markers = [
    { top: "8%", left: "16%", n: 1 },
    { top: "20%", left: "84%", n: 2 },
    { top: "62%", left: "10%", n: 3 },
  ];
  const findings = [
    "Slight whitening on one rear corner",
    "Small edge nick",
    "Front centring approximately 53/47",
    "Surface looks clean in the supplied photo",
  ];
  return (
    <section
      id="condition"
      className="relative scroll-mt-20 border-y border-border-subtle bg-surface-raised/40"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24">
        <SectionHeading
          kicker="Check the condition"
          title="See what could affect the grade."
          copy="CardCrop checks the visible condition of your card, including centring, corners, edges and surface marks."
        />
        <div className="mt-12 grid lg:grid-cols-2 gap-10 items-center">
          <div className="relative mx-auto w-[78%] max-w-xs">
            <HoloCard src={HERO_CARD} alt="Card with highlighted condition markers" />
            {markers.map((m) => (
              <span
                key={m.n}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-7 h-7 rounded-full bg-accent text-white text-xs font-bold ring-4 ring-accent/25 shadow-lg"
                style={{ top: m.top, left: m.left }}
              >
                {m.n}
              </span>
            ))}
          </div>
          <ul className="space-y-3">
            {findings.map((f, i) => (
              <li
                key={f}
                className="flex items-start gap-3 rounded-xl border border-border-subtle bg-surface-raised px-4 py-3.5"
              >
                <span className="mt-0.5 w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <span className="text-sm text-text-primary">{f}</span>
              </li>
            ))}
            <li className="text-xs text-text-muted pt-1">Example findings for illustration.</li>
          </ul>
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
    { name: "PSA", grade: "8–9", label: "Main concern", note: "Rear corner whitening", conf: "Medium" },
    { name: "ACE", grade: "9", label: "Main concern", note: "Rear corner whitening", conf: "Medium" },
    { name: "CGC", grade: "8.5–9", label: "Main concern", note: "Edge wear", conf: "Medium" },
    { name: "Beckett", grade: "8.5", label: "Strongest area", note: "Centring", conf: "Medium" },
  ];
  return (
    <section id="compare" className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24 scroll-mt-20">
      <SectionHeading
        kicker="Compare grading companies"
        title="One card. Different grading outcomes."
        copy="Compare estimated results for popular grading companies before deciding where to send your card."
      />
      <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                Estimated grade
              </div>
              <div className="text-3xl font-semibold text-text-primary">{g.grade}</div>
            </div>
            <div className="mt-4 text-sm">
              <div className="text-text-muted text-[11px]">{g.label}</div>
              <div className="text-text-primary">{g.note}</div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-text-secondary">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent" />
              Confidence: {g.conf}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-text-muted">
        Example estimates. CardCrop is not affiliated with any grading company and does
        not provide official grades.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Why people use CardCrop                                             */
/* ------------------------------------------------------------------ */

function WhySection() {
  const uses = [
    {
      icon: Tag,
      title: "Selling cards",
      copy: "Create clean, consistent images for listings without manually editing every photograph.",
    },
    {
      icon: ShieldCheck,
      title: "Preparing for grading",
      copy: "Check for visible issues before paying submission fees.",
    },
    {
      icon: Scale,
      title: "Comparing graders",
      copy: "See how the same card may be viewed under different grading standards.",
    },
    {
      icon: Layers,
      title: "Cataloguing a collection",
      copy: "Keep clean and consistent front and back images of your cards.",
    },
    {
      icon: FolderOpen,
      title: "Sorting larger collections",
      copy: "Quickly identify cards that deserve a closer look.",
    },
  ];
  return (
    <section className="border-y border-border-subtle bg-surface-raised/40">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24">
        <SectionHeading kicker="Why collectors use it" title="Built around the way you handle cards." />
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {uses.map((u) => (
            <div
              key={u.title}
              className="rounded-2xl border border-border-subtle bg-surface-raised p-5 hover:border-accent/40 transition-colors"
            >
              <span className="inline-flex w-10 h-10 rounded-xl bg-accent/15 items-center justify-center">
                <u.icon className="w-5 h-5 text-accent" />
              </span>
              <h3 className="mt-4 text-base font-semibold">{u.title}</h3>
              <p className="mt-1.5 text-sm text-text-secondary">{u.copy}</p>
            </div>
          ))}
          <div className="relative rounded-2xl border border-border-subtle bg-gradient-to-br from-surface-overlay to-surface-raised p-5 overflow-hidden flex items-center">
            <img
              src={ALT_CARD}
              alt="Example trading card"
              className="absolute -right-6 -bottom-8 w-36 opacity-90 rotate-6 drop-shadow-2xl"
              draggable={false}
            />
            <p className="relative text-sm text-text-secondary max-w-[60%]">
              Every card, presented at its best.
            </p>
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
    { icon: Camera, title: "Take a photo", copy: "Photograph the front and back in clear lighting." },
    { icon: Wand2, title: "Clean it up", copy: "CardCrop straightens and extracts the card." },
    {
      icon: ScanSearch,
      title: "Check the condition",
      copy: "See visible concerns around the centring, corners, edges and surface.",
    },
    {
      icon: Scale,
      title: "Compare and decide",
      copy: "Review estimated grades and decide whether and where to submit.",
    },
  ];
  return (
    <section id="how" className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24 scroll-mt-20">
      <SectionHeading kicker="How it works" title="Four simple steps." />
      <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {steps.map((s, i) => (
          <div
            key={s.title}
            className="relative rounded-2xl border border-border-subtle bg-surface-raised p-5"
          >
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
/* Honest & useful                                                     */
/* ------------------------------------------------------------------ */

function HonestSection() {
  return (
    <section className="mx-auto max-w-3xl px-4 sm:px-6 pb-16 sm:pb-24">
      <div className="rounded-2xl border border-border-subtle bg-surface-raised p-6 sm:p-8 text-center">
        <span className="inline-flex w-11 h-11 rounded-xl bg-accent/15 items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-accent" />
        </span>
        <h2 className="mt-4 text-xl sm:text-2xl font-semibold tracking-tight">
          Helpful guidance before you submit.
        </h2>
        <p className="mt-3 text-text-secondary">
          CardCrop gives you an estimate based on what can be seen in your photographs.
          Very fine scratches, dents or marks hidden by glare may not be visible, so
          valuable cards should always be checked carefully by hand.
        </p>
        <p className="mt-3 text-sm text-text-muted">
          Official grades are decided by the grading company after inspecting the physical card.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Final CTA                                                           */
/* ------------------------------------------------------------------ */

function FinalCta() {
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
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">Start with a photo.</h2>
        <p className="mt-4 text-text-secondary max-w-xl mx-auto">
          Create a clean card image, check the condition and compare estimated grades.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/crop"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-7 py-3.5 text-sm font-semibold text-white hover:bg-accent-hover transition-colors shadow-lg shadow-accent/25"
          >
            <Upload className="w-4 h-4" />
            Upload a card
          </Link>
          <a
            href="#compare"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface-overlay/40 px-7 py-3.5 text-sm font-semibold text-text-primary hover:bg-surface-overlay transition-colors"
          >
            View an example report
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
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
