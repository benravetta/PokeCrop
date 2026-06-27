import { Link } from "react-router-dom";
import { ArrowRight, Check, Link2, MessageSquare, UserCircle } from "lucide-react";
import { SectionHeading } from "../../components/landing/shared";
import { COLLECTOR_PROFILES } from "./collectorProfilesCopy";
import { guestSignupPath, useInviteRequired } from "../../hooks/useInviteRequired";
import { NAV } from "../../lib/marketingCopy";

export function CollectorProfilesHomeSection({ loggedIn }: { loggedIn: boolean }) {
  const { inviteRequired } = useInviteRequired();
  const home = COLLECTOR_PROFILES.home;

  const primaryHref = loggedIn ? "/collector/profile" : guestSignupPath(inviteRequired);
  const primaryLabel = loggedIn
    ? home.ctaLoggedIn
    : inviteRequired
      ? NAV.joinWaitlist
      : home.ctaGuest;

  return (
    <section
      id="collector-profiles"
      className="relative scroll-mt-20 overflow-hidden border-b border-border-subtle py-14 sm:py-16"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 80% at 80% 40%, rgba(124,108,246,0.12), transparent 55%), radial-gradient(ellipse 50% 60% at 10% 70%, rgba(14,165,233,0.08), transparent 50%)",
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
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  {line}
                </li>
              ))}
            </ul>

            <p className="mt-6 text-sm text-text-muted">{home.priceSuffix}</p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                to={primaryHref}
                state={loggedIn ? undefined : { from: "/collector/setup" }}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition hover:bg-accent-hover"
              >
                {primaryLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
              {!loggedIn && inviteRequired ? (
                <Link
                  to="/login"
                  state={{ from: "/collector/setup" }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface-raised/60 px-6 py-3.5 text-sm font-semibold text-text-primary transition hover:bg-surface-overlay"
                >
                  {NAV.signIn}
                </Link>
              ) : (
                <Link
                  to="/collector/setup"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface-raised/60 px-6 py-3.5 text-sm font-semibold text-text-primary transition hover:bg-surface-overlay"
                >
                  {home.ctaSecondary}
                </Link>
              )}
            </div>

            {!loggedIn && !inviteRequired ? (
              <p className="mt-4 text-xs text-text-muted">
                Free account required.{" "}
                <Link to="/login" state={{ from: "/collector/setup" }} className="text-accent hover:text-accent-hover">
                  Sign in
                </Link>{" "}
                if you already have one.
              </p>
            ) : null}

            <p className="mt-4 text-xs text-text-muted leading-relaxed">{home.disclaimer}</p>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div
              aria-hidden
              className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-accent/15 to-transparent blur-2xl"
            />
            <div className="relative rounded-2xl border border-accent/25 bg-surface-raised/90 p-5 shadow-xl shadow-black/30 sm:p-6">
              <div className="flex items-center gap-3 border-b border-border-subtle pb-4">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent/15">
                  <UserCircle className="h-6 w-6 text-accent" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-text-primary">PokeTrader_UK</p>
                  <p className="text-xs text-text-muted">gemcheck.co.uk/u/poketrader_uk</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {["Showcase", "For trade", "Wanted"].map((label) => (
                  <div
                    key={label}
                    className="rounded-lg border border-border-subtle bg-surface/50 px-2 py-2 text-center text-[10px] font-medium text-text-secondary"
                  >
                    {label}
                  </div>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="aspect-[3/4] rounded-lg border border-border-subtle bg-surface-overlay/80" />
                <div className="aspect-[3/4] rounded-lg border border-border-subtle bg-surface-overlay/80" />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 rounded-md border border-accent/20 bg-accent/10 px-2 py-1 text-[10px] font-medium text-accent">
                  <Link2 className="h-3 w-3" />
                  Share profile
                </span>
                <span className="inline-flex items-center gap-1 rounded-md border border-border-subtle bg-surface/50 px-2 py-1 text-[10px] font-medium text-text-secondary">
                  <MessageSquare className="h-3 w-3" />
                  Trade enquiry
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
