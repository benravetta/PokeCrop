import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Mail,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react";
import { TurnstileField } from "../TurnstileWidget";
import { useTurnstileToken } from "../../hooks/useTurnstile";
import { submitInviteRequest } from "../../lib/api";
import { TRUST_STRIP, WAITLIST } from "../../lib/marketingCopy";
import { SiteFooter } from "../landing/FooterSections";
import { GuestMarketingHeader } from "../header/GuestMarketingHeader";
import { HERO_CARD_IMG } from "../landing/data";

const STEP_ICONS = [Users, UserCheck, Mail, Sparkles] as const;

function WaitlistPreview({ activeStep }: { activeStep: number }) {
  const panels = [
    {
      badge: "Step 1",
      title: "Your request",
      body: "Name, email and a short note about what you collect.",
      accent: "from-accent/20 to-transparent",
    },
    {
      badge: "In review",
      title: "Team review",
      body: "We read every submission — shops, sellers and collectors.",
      accent: "from-sky-500/20 to-transparent",
    },
    {
      badge: "Approved",
      title: "Invite email",
      body: "A private link to create your GemCheck account.",
      accent: "from-emerald-500/20 to-transparent",
    },
    {
      badge: "Ready",
      title: "First card check",
      body: "Upload photos and see estimates across five graders.",
      accent: "from-violet-500/20 to-transparent",
    },
  ];
  const panel = panels[activeStep] ?? panels[0];

  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-accent/15 via-transparent to-sky-500/10 blur-2xl"
      />
      <div className="relative overflow-hidden rounded-2xl border border-border-subtle bg-surface-raised/90 shadow-2xl shadow-black/40">
        <div className={`bg-gradient-to-br ${panel.accent} p-6 sm:p-8`}>
          <span className="inline-flex rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
            {panel.badge}
          </span>
          <h3 className="mt-4 text-xl font-semibold tracking-tight">{panel.title}</h3>
          <p className="mt-2 text-sm text-text-secondary leading-relaxed">{panel.body}</p>
        </div>
        <div className="relative flex items-center justify-center p-6 sm:p-8 bg-surface-raised">
          <div className="relative w-[58%] max-w-[220px] -rotate-3 transition-transform duration-500 hover:rotate-0">
            <img
              src={HERO_CARD_IMG}
              alt=""
              draggable={false}
              className="w-full drop-shadow-[0_24px_48px_rgba(0,0,0,0.45)]"
            />
            <span className="absolute -right-2 -top-2 rounded-full border border-accent/40 bg-accent/20 px-2.5 py-1 text-[10px] font-semibold text-accent backdrop-blur-sm">
              Pre-grade
            </span>
          </div>
          <div className="absolute bottom-4 left-4 right-4 rounded-xl border border-white/5 bg-black/35 px-3 py-2 backdrop-blur-md">
            <p className="text-[11px] font-medium text-text-primary">GemCheck beta access</p>
            <p className="text-[10px] text-text-muted">Invite-only while we scale up</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WaitlistLanding() {
  const turnstile = useTurnstileToken();
  const [activeStep, setActiveStep] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const scrollToForm = () => {
    document.getElementById("waitlist-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!turnstile.ready) {
      setError("Complete the security check.");
      return;
    }
    setLoading(true);
    try {
      await submitInviteRequest({
        email,
        name: name.trim() || undefined,
        message: message.trim() || undefined,
        turnstileToken: turnstile.token ?? undefined,
      });
      setSent(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      turnstile.reset();
      setError(err instanceof Error ? err.message : "Could not submit request.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-[100dvh] bg-surface text-text-primary flex flex-col landing-mesh">
        <GuestMarketingHeader />
        <main className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="max-w-lg text-center anim-rise">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent/15">
              <CheckCircle2 className="h-7 w-7 text-accent" />
            </span>
            <h1 className="mt-6 text-3xl sm:text-4xl font-semibold tracking-tight">
              {WAITLIST.successTitle}
            </h1>
            <p className="mt-4 text-base text-text-secondary leading-relaxed">
              {WAITLIST.successBody}
            </p>
            <p className="mt-6 text-sm text-text-muted">
              Already invited?{" "}
              <Link to="/login" className="text-accent hover:text-accent-hover font-medium">
                Sign in
              </Link>
            </p>
            <Link
              to="/"
              className="mt-8 inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary"
            >
              Back to homepage
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-surface text-text-primary flex flex-col">
      <GuestMarketingHeader />

      <section className="relative overflow-hidden landing-mesh border-b border-border-subtle">
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-12 pb-16 sm:pt-16 sm:pb-20">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="anim-rise">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent mb-3">
                {WAITLIST.heroEyebrow}
              </p>
              <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.08] text-balance">
                {WAITLIST.heroTitle}
              </h1>
              <p className="mt-5 text-base sm:text-lg text-text-secondary leading-relaxed max-w-lg">
                {WAITLIST.heroBody}
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={scrollToForm}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-sm font-semibold text-white hover:bg-accent-hover transition-all shadow-lg shadow-accent/25"
                >
                  {WAITLIST.joinLabel}
                  <ArrowRight className="w-4 h-4" />
                </button>
                <Link
                  to="/sample-report"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface-raised/60 px-6 py-3.5 text-sm font-semibold text-text-primary hover:bg-surface-overlay transition-colors"
                >
                  View sample report
                </Link>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-4 gap-y-2">
                {TRUST_STRIP.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-1.5 text-xs text-text-secondary"
                  >
                    <Check className="w-3.5 h-3.5 text-accent shrink-0" />
                    {item}
                  </span>
                ))}
              </div>
              <p className="mt-6 text-sm text-text-muted">
                Already invited?{" "}
                <Link to="/login" className="text-accent hover:text-accent-hover font-medium">
                  Sign in
                </Link>
              </p>
            </div>
            <div className="anim-scale lg:pl-4">
              <WaitlistPreview activeStep={activeStep} />
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20 border-b border-border-subtle bg-surface-raised/30">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent mb-3 text-center">
            How it works
          </p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-center text-balance">
            From waitlist to your first pre-grade
          </h2>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {WAITLIST.steps.map((step, index) => {
              const Icon = STEP_ICONS[index] ?? Users;
              const active = activeStep === index;
              return (
                <button
                  key={step.title}
                  type="button"
                  onClick={() => setActiveStep(index)}
                  className={`text-left rounded-2xl border p-5 transition-all ${
                    active
                      ? "border-accent/50 bg-accent/10 shadow-lg shadow-accent/10"
                      : "border-border-subtle bg-surface-raised hover:border-border-strong hover:bg-surface-overlay/50"
                  }`}
                >
                  <span
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${
                      active ? "bg-accent/20 text-accent" : "bg-surface-overlay text-text-muted"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    Step {index + 1}
                  </p>
                  <h3 className="mt-1 text-base font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm text-text-secondary leading-relaxed">{step.body}</p>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20 border-b border-border-subtle">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-10 items-start">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">What you&apos;ll get access to</h2>
              <ul className="mt-6 space-y-3">
                {WAITLIST.perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-2.5 text-sm text-text-secondary">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    {perk}
                  </li>
                ))}
              </ul>
              <div className="mt-8 space-y-4">
                {WAITLIST.faq.map((item) => (
                  <div
                    key={item.q}
                    className="rounded-xl border border-border-subtle bg-surface-raised p-4"
                  >
                    <h3 className="text-sm font-semibold">{item.q}</h3>
                    <p className="mt-1.5 text-sm text-text-secondary leading-relaxed">{item.a}</p>
                  </div>
                ))}
              </div>
            </div>

            <div
              id="waitlist-form"
              className="scroll-mt-24 rounded-2xl border border-border-subtle bg-surface-raised p-6 sm:p-8 shadow-xl shadow-black/20"
            >
              <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">{WAITLIST.formTitle}</h2>
              <p className="mt-2 text-sm text-text-secondary">{WAITLIST.formSubtitle}</p>

              <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
                {error ? (
                  <p className="text-[13px] text-error rounded-lg border border-error/20 bg-error/5 px-3 py-2">
                    {error}
                  </p>
                ) : null}
                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium">Name (optional)</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="rounded-lg border border-border-subtle bg-surface px-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-accent/40"
                    autoComplete="name"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium">Email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="rounded-lg border border-border-subtle bg-surface px-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-accent/40"
                    autoComplete="email"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium">What do you collect? (optional)</span>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    placeholder="e.g. Pokémon vintage, modern sports, shop inventory…"
                    className="rounded-lg border border-border-subtle bg-surface px-3 py-2.5 text-[14px] resize-y focus:outline-none focus:ring-2 focus:ring-accent/40"
                  />
                </label>
                <TurnstileField {...turnstile} />
                <button
                  type="submit"
                  disabled={loading || !turnstile.ready}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {WAITLIST.submitLabel}
                  {!loading ? <ArrowRight className="w-4 h-4" /> : null}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
