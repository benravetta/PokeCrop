import { Link } from "react-router-dom";
import { ArrowRight, Check, Clock, UserCheck } from "lucide-react";
import { SectionHeading } from "../landing/shared";
import { EXPERT_REVIEW } from "../../humanPregrade/landing/expertReviewCopy";
import { formatMinorUnits, useHumanPregradeConfig } from "../../humanPregrade/hooks/useHumanPregradeConfig";
import { guestSignupPath, useInviteRequired } from "../../hooks/useInviteRequired";

export function ExpertReviewHomeSection({ loggedIn }: { loggedIn: boolean }) {
  const { enabled, config, loading } = useHumanPregradeConfig();
  const { inviteRequired } = useInviteRequired();

  if (loggedIn && !loading && !enabled) return null;

  const home = EXPERT_REVIEW.home;
  const price = config
    ? formatMinorUnits(config.priceMinorUnits, config.currency)
    : home.priceFallback;
  const turnaround = config?.expectedTurnaroundHours ?? 48;
  const productName = config?.productName ?? "Expert Review";

  const primaryHref = loggedIn ? "/human-pregrade" : guestSignupPath(inviteRequired);
  const primaryLabel = loggedIn
    ? home.ctaLoggedIn
    : inviteRequired
      ? "Join waitlist"
      : home.ctaGuest;

  return (
    <section
      id="expert-review"
      className="relative scroll-mt-20 overflow-hidden border-b border-border-subtle py-14 sm:py-16"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 80% at 20% 50%, rgba(14,165,233,0.12), transparent 55%), radial-gradient(ellipse 50% 60% at 90% 30%, rgba(124,108,246,0.08), transparent 50%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <div>
            <SectionHeading
              kicker={home.kicker}
              title={home.title}
              copy={home.copy}
              center={false}
            />

            <ul className="mt-6 space-y-2.5">
              {home.bullets.map((line) => (
                <li key={line} className="flex items-start gap-2.5 text-sm text-text-secondary">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
                  {line}
                </li>
              ))}
            </ul>

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold tabular-nums text-text-primary">{price}</span>
                <span className="text-sm text-text-muted">{home.priceSuffix}</span>
              </div>
              <span className="inline-flex items-center gap-1.5 text-sm text-text-secondary">
                <Clock className="h-4 w-4 text-sky-400" />~{turnaround}h turnaround
              </span>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                to={primaryHref}
                state={loggedIn ? undefined : { from: "/human-pregrade" }}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:brightness-110"
              >
                {primaryLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to={loggedIn ? "/human-pregrade" : "/login"}
                state={loggedIn ? undefined : { from: "/human-pregrade" }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface-raised/60 px-6 py-3.5 text-sm font-semibold text-text-primary transition hover:bg-surface-overlay"
              >
                {loggedIn ? "Start a review" : home.ctaSecondary}
              </Link>
            </div>

            {!loggedIn ? (
              <p className="mt-4 text-xs text-text-muted">
                {inviteRequired ? (
                  <>
                    Invite-only during beta.{" "}
                    <Link to="/login" state={{ from: "/human-pregrade" }} className="text-sky-400 hover:text-sky-300">
                      Sign in
                    </Link>{" "}
                    if you already have access.
                  </>
                ) : (
                  <>
                    Free account required.{" "}
                    <Link to="/login" state={{ from: "/human-pregrade" }} className="text-sky-400 hover:text-sky-300">
                      Sign in
                    </Link>{" "}
                    if you already have one.
                  </>
                )}
              </p>
            ) : null}
          </div>

          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div
              aria-hidden
              className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-sky-500/15 to-transparent blur-2xl"
            />
            <div className="relative rounded-2xl border border-sky-500/25 bg-surface-raised/90 p-5 shadow-xl shadow-black/30 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="relative shrink-0">
                  <div className="h-24 w-[4.5rem] overflow-hidden rounded-lg border border-border-subtle shadow-lg sm:h-28 sm:w-[5.25rem]">
                    <img
                      src="/demo-charizard-crop.png"
                      alt=""
                      className="h-full w-full object-cover"
                      draggable={false}
                    />
                  </div>
                  <span className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full border border-sky-400/40 bg-sky-500/20 text-sky-200">
                    <UserCheck className="h-4 w-4" />
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-300/90">
                    {productName}
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-snug text-text-primary">
                    Human review · not just AI
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-text-secondary">
                    &ldquo;Light holo scratching under raking light; corners sharp. Likely PSA 8
                    — recommend Economy tier.&rdquo;
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {["PSA 8", "CGC 8.5", "Written PDF"].map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-200"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-border-subtle bg-surface/50 px-3 py-2.5">
                <p className="text-[11px] text-text-muted">
                  Separate from AI pre-grade · independent opinion · photos only
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
