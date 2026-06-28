import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, KeyRound, ShieldCheck, Terminal, Zap } from "lucide-react";
import { API_SNIPPET } from "./data";
import { SectionHeading } from "./shared";
import { ESTIMATE_DISCLAIMER, FOOTER, GRADER_INDEPENDENCE } from "../../lib/marketingCopy";
import {
  FOOTER_LEGAL_LINKS,
  FOOTER_NAV_GROUPS,
  type SiteNavItem,
} from "../../lib/siteNav";
import { STAFF_ACCOUNT } from "../../lib/adminAccess";
import { FooterLegalBlock } from "../pageLayout/FooterLegalBlock";
import { Wordmark } from "./shared";
import type { Plan } from "../../lib/plans";

export function ApiSection({
  plan,
  loggedIn,
  isAdmin = false,
  onUpgrade,
}: {
  plan: Plan | null;
  loggedIn: boolean;
  isAdmin?: boolean;
  onUpgrade: () => void;
}) {
  const endpoints = [
    ["POST", "/v1/crop", "Crop & straighten a card"],
    ["POST", "/v1/grade", "Pre-grade (JSON or PDF report)"],
    ["GET", "/v1/grade/quota", "Grading allowance"],
    ["GET", "/v1/account", "Plan + quota snapshot"],
    ["GET", "/v1/usage", "API usage history"],
    ["GET", "/v1/openapi.json", "OpenAPI 3.1 spec"],
  ];

  let cta: { label: string; action: () => void };
  if (isAdmin || plan === "api") {
    cta = {
      label: STAFF_ACCOUNT.apiCta,
      action: () => (window.location.href = "/account"),
    };
  } else if (loggedIn) {
    cta = { label: "Upgrade to Enterprise (from £29.99/mo)", action: onUpgrade };
  } else {
    cta = { label: "Request trade pricing", action: () => (window.location.href = "/trade") };
  }

  return (
    <section id="api" className="relative scroll-mt-20 border-y border-border-subtle bg-surface-raised/40">
      <div className="mx-auto w-full max-w-6xl page-x py-16 sm:py-24">
        <SectionHeading
          kicker="For developers and trade"
          title="Bulk checks for shops and automation"
          copy="Bulk-process listings, run pre-grades at scale, or wire GemCheck into your shop workflow. Same engine as the web app."
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
              <code className="text-text-secondary">image_base64</code> as JSON.
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

export function HonestSection() {
  return null;
}

const footerLinkClass =
  "text-sm text-text-secondary transition-colors hover:text-text-primary";

function FooterNavColumn({ title, links }: { title: string; links: readonly SiteNavItem[] }) {
  return (
    <div>
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
        {title}
      </h2>
      <ul className="mt-3 space-y-2.5">
        {links.map((item) => (
          <li key={item.href}>
            {item.external ? (
              <a
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1 ${footerLinkClass}`}
              >
                {item.label}
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
              </a>
            ) : (
              <Link to={item.href} className={footerLinkClass}>
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border-subtle bg-surface-raised/30 footer-py-marketing">
      <div className="mx-auto w-full max-w-6xl page-x">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_repeat(3,minmax(0,1fr))] lg:gap-8 xl:gap-12">
          <div className="text-center lg:text-left">
            <Wordmark className="mx-auto lg:mx-0" />
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-text-secondary lg:mx-0">
              {FOOTER.tagline}
            </p>
            <a
              href="https://getlooky.uk"
              target="_blank"
              rel="noopener noreferrer"
              className={`mt-4 inline-flex items-center gap-1.5 ${footerLinkClass}`}
            >
              A Looky Collectibles tool
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
            </a>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:contents">
            {FOOTER_NAV_GROUPS.map((group) => (
              <FooterNavColumn key={group.label} title={group.label} links={group.links} />
            ))}
          </div>
        </div>

        <div className="mt-10 space-y-2 border-t border-border-subtle pt-8 lg:mt-12">
          <FooterLegalBlock className="mx-auto max-w-3xl text-center lg:mx-0 lg:text-left">
            {ESTIMATE_DISCLAIMER}
          </FooterLegalBlock>
          <FooterLegalBlock className="mx-auto max-w-3xl text-center lg:mx-0 lg:text-left">
            {GRADER_INDEPENDENCE}
          </FooterLegalBlock>
        </div>

        <div className="mt-6 flex flex-col items-center gap-3 text-center lg:mt-8 lg:flex-row lg:items-center lg:justify-between lg:text-left">
          <nav
            aria-label="Legal"
            className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 lg:justify-start"
          >
            {FOOTER_LEGAL_LINKS.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className="text-xs text-text-muted transition-colors hover:text-text-primary"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <p className="text-xs text-text-muted">{FOOTER.location}</p>
        </div>
      </div>
    </footer>
  );
}
