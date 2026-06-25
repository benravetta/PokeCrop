import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Bot,
  Camera,
  Check,
  ChevronRight,
  Clock,
  CreditCard,
  Shield,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { SectionHeading } from "../../components/landing/shared";
import { EXPERT_REVIEW } from "./expertReviewCopy";
import { ExpertReportMockup } from "./ExpertReportMockup";
import { formatMinorUnits } from "../hooks/useHumanPregradeConfig";
import type { HumanPregradeConfig } from "../api";

const STEP_ICONS = {
  camera: Camera,
  card: CreditCard,
  expert: UserCheck,
  report: Sparkles,
} as const;

function FlowGraphic({ activeIndex, priceLabel }: { activeIndex: number; priceLabel: string }) {
  const visuals = [
    {
      title: "Your photos",
      body: "Front & back · good lighting · minimal glare",
      img: "/demo-before.jpg",
      overlay: "Upload",
    },
    {
      title: "Secure checkout",
      body: "One-off payment · track in your account",
      img: null,
      overlay: priceLabel,
    },
    {
      title: "Expert review",
      body: "Human assessor · condition notes · grader predictions",
      img: "/demo-charizard-crop.png",
      overlay: "In review",
    },
    {
      title: "Your PDF report",
      body: "Download · share · submit with confidence",
      img: null,
      overlay: "Ready",
    },
  ];

  const v = visuals[activeIndex] ?? visuals[0];

  return (
    <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl border border-sky-500/20 bg-gradient-to-br from-surface-raised via-surface to-sky-950/30 p-6">
      <div
        aria-hidden
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 30% 20%, rgba(56,189,248,0.25), transparent 45%), radial-gradient(circle at 70% 80%, rgba(124,108,246,0.15), transparent 40%)",
        }}
      />

      {v.img ? (
        <div className="relative z-10 w-[55%] max-w-[11rem] rotate-[-4deg] transition-transform duration-500 hover:rotate-0">
          <div className="overflow-hidden rounded-xl border border-white/10 shadow-2xl shadow-black/50">
            <img src={v.img} alt="" className="aspect-[5/7] w-full object-cover" draggable={false} />
          </div>
          <span className="absolute -right-2 -top-2 rounded-full border border-sky-400/40 bg-sky-500/20 px-2.5 py-1 text-[10px] font-semibold text-sky-100 backdrop-blur-sm">
            {v.overlay}
          </span>
        </div>
      ) : activeIndex === 1 ? (
        <div className="relative z-10 w-full max-w-[14rem] rounded-2xl border border-border-subtle bg-surface-overlay/80 p-5 shadow-xl anim-scale-in">
          <div className="flex items-center gap-2 text-text-muted">
            <CreditCard className="h-4 w-4" />
            <span className="text-xs font-medium">Stripe checkout</span>
          </div>
          <p className="mt-4 text-3xl font-bold tabular-nums text-text-primary">{v.overlay}</p>
          <p className="mt-1 text-xs text-text-secondary">One-time expert review</p>
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
            <Shield className="h-3.5 w-3.5" />
            Encrypted payment
          </div>
        </div>
      ) : (
        <div className="relative z-10 w-full max-w-[15rem] rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center shadow-xl anim-scale-in">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
            <Check className="h-6 w-6" />
          </div>
          <p className="mt-3 text-lg font-semibold text-text-primary">{v.title}</p>
          <p className="mt-1 text-xs text-text-secondary">{v.body}</p>
        </div>
      )}

      <div className="absolute bottom-4 left-4 right-4 z-10 rounded-xl border border-white/5 bg-black/30 px-3 py-2 backdrop-blur-md">
        <p className="text-xs font-semibold text-text-primary">{v.title}</p>
        <p className="text-[11px] text-text-secondary">{v.body}</p>
      </div>
    </div>
  );
}

type ExpertReviewLandingProps = {
  config: HumanPregradeConfig;
  orderCount?: number;
};

export function ExpertReviewLanding({ config, orderCount = 0 }: ExpertReviewLandingProps) {
  const [activeStep, setActiveStep] = useState(0);
  const price = formatMinorUnits(config.priceMinorUnits, config.currency);
  const turnaround = config.expectedTurnaroundHours;

  return (
    <div className="relative">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border-subtle">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(14,165,233,0.18), transparent 55%), radial-gradient(ellipse 50% 40% at 90% 20%, rgba(124,108,246,0.12), transparent 50%)",
          }}
        />

        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-2 lg:items-center lg:gap-12 lg:py-16">
          <div className="anim-rise">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-sky-200">
              <UserCheck className="h-3.5 w-3.5" />
              {EXPERT_REVIEW.kicker}
            </div>

            <h1 className="mt-5 text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-[2.65rem] lg:leading-[1.12]">
              {config.productName || EXPERT_REVIEW.heroTitle}
            </h1>

            <p className="mt-4 max-w-xl text-base leading-relaxed text-text-secondary sm:text-lg">
              {config.productDescription || EXPERT_REVIEW.heroCopy}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums text-text-primary">{price}</span>
                <span className="text-sm text-text-muted">per card</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-text-secondary">
                <Clock className="h-4 w-4 text-sky-400" />~{turnaround}h turnaround
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                to="/human-pregrade/new"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 transition hover:brightness-110"
              >
                {EXPERT_REVIEW.ctaPrimary}
                <ArrowRight className="h-4 w-4" />
              </Link>
              {orderCount > 0 ? (
                <Link
                  to="/human-pregrade/orders"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface-raised/60 px-6 py-3.5 text-sm font-semibold text-text-primary transition hover:bg-surface-overlay"
                >
                  {EXPERT_REVIEW.ctaSecondary}
                  <ChevronRight className="h-4 w-4" />
                </Link>
              ) : null}
            </div>
          </div>

          <div className="relative lg:pl-4">
            <div
              aria-hidden
              className="absolute -left-8 top-1/2 h-48 w-48 -translate-y-1/2 rounded-full bg-sky-500/10 blur-3xl"
            />
            <ExpertReportMockup />
          </div>
        </div>
      </section>

      {/* AI vs Expert */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <SectionHeading
          kicker={EXPERT_REVIEW.compare.kicker}
          title={EXPERT_REVIEW.compare.title}
        />

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <div className="group rounded-2xl border border-border-subtle bg-surface-raised p-6 transition hover:border-accent/30">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent">
                  <Bot className="h-4 w-4" />
                </span>
                <span className="font-semibold text-text-primary">{EXPERT_REVIEW.compare.ai.label}</span>
              </div>
              <span className="rounded-full bg-accent/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent">
                {EXPERT_REVIEW.compare.ai.badge}
              </span>
            </div>
            <ul className="mt-5 space-y-2.5">
              {EXPERT_REVIEW.compare.ai.points.map((p) => (
                <li key={p} className="flex items-start gap-2 text-sm text-text-secondary">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent/80" />
                  {p}
                </li>
              ))}
            </ul>
            <Link
              to="/grade"
              className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-accent hover:text-accent-hover"
            >
              Try AI pre-grade
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="group rounded-2xl border border-sky-500/25 bg-gradient-to-br from-sky-500/10 to-surface-raised p-6 shadow-lg shadow-sky-500/5 transition hover:border-sky-400/40">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/20 text-sky-300">
                  <UserCheck className="h-4 w-4" />
                </span>
                <span className="font-semibold text-text-primary">{EXPERT_REVIEW.compare.expert.label}</span>
              </div>
              <span className="rounded-full bg-sky-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-sky-200">
                {EXPERT_REVIEW.compare.expert.badge}
              </span>
            </div>
            <ul className="mt-5 space-y-2.5">
              {EXPERT_REVIEW.compare.expert.points.map((p) => (
                <li key={p} className="flex items-start gap-2 text-sm text-text-secondary">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
                  {p}
                </li>
              ))}
            </ul>
            <Link
              to="/human-pregrade/new"
              className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-sky-300 hover:text-sky-200"
            >
              Start expert review
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Interactive flow */}
      <section className="border-y border-border-subtle bg-surface-raised/40">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
          <SectionHeading
            kicker={EXPERT_REVIEW.flow.kicker}
            title={EXPERT_REVIEW.flow.title}
          />

          <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
            <div className="space-y-2">
              {EXPERT_REVIEW.flow.steps.map((step, index) => {
                const Icon = STEP_ICONS[step.icon];
                const active = activeStep === index;
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setActiveStep(index)}
                    className={`flex w-full items-start gap-4 rounded-xl border px-4 py-4 text-left transition ${
                      active
                        ? "border-sky-500/40 bg-sky-500/10 shadow-md shadow-sky-500/5"
                        : "border-border-subtle bg-surface/40 hover:border-border-strong hover:bg-surface-overlay/50"
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        active ? "bg-sky-500/20 text-sky-200" : "bg-surface-overlay text-text-muted"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                          Step {index + 1}
                        </span>
                        {active ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-sky-400 anim-fade" aria-hidden />
                        ) : null}
                      </div>
                      <p className="mt-0.5 font-semibold text-text-primary">{step.title}</p>
                      {active ? (
                        <p className="mt-1.5 text-sm leading-relaxed text-text-secondary anim-fade">
                          {step.copy}
                        </p>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>

            <FlowGraphic activeIndex={activeStep} priceLabel={price} />
          </div>
        </div>
      </section>

      {/* What's included */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <SectionHeading kicker={EXPERT_REVIEW.includes.kicker} title={EXPERT_REVIEW.includes.title} />

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EXPERT_REVIEW.includes.items.map((item, i) => (
            <div
              key={item.title}
              className="rounded-2xl border border-border-subtle bg-surface-raised p-5 transition hover:border-sky-500/20 hover:bg-surface-overlay/30"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <span className="text-xs font-bold tabular-nums text-sky-400/80">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-2 font-semibold text-text-primary">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">{item.copy}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Disclaimers + final CTA */}
      <section className="border-t border-border-subtle bg-surface-raised/60">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-xl font-semibold text-text-primary">Before you submit</h2>
              <ul className="mt-4 space-y-2.5">
                {(config.customerDisclaimer
                  ? [config.customerDisclaimer, ...EXPERT_REVIEW.disclaimers]
                  : EXPERT_REVIEW.disclaimers
                ).map((line) => (
                  <li key={line} className="flex items-start gap-2 text-sm text-text-muted">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-text-muted" aria-hidden />
                    {line}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-sky-500/25 bg-gradient-to-br from-sky-500/10 via-surface-raised to-surface-raised p-6 sm:p-8">
              <p className="text-sm font-medium text-sky-200">Ready when you are</p>
              <p className="mt-2 text-2xl font-semibold text-text-primary">
                {price} · expert report in ~{turnaround} hours
              </p>
              <p className="mt-2 text-sm text-text-secondary">
                Upload photos, pay securely, and track progress from your account.
              </p>
              <Link
                to="/human-pregrade/new"
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:brightness-110 sm:w-auto"
              >
                {EXPERT_REVIEW.ctaPrimary}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
