import { Link } from "react-router-dom";
import { ArrowRight, KeyRound, ShieldCheck, Terminal, Zap } from "lucide-react";
import { API_SNIPPET } from "./data";
import { SectionHeading } from "./shared";

type Plan = "free" | "unlimited" | "api" | null;

export function ApiSection({
  plan,
  loggedIn,
  onUpgrade,
}: {
  plan: Plan;
  loggedIn: boolean;
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
  if (plan === "api") {
    cta = { label: "Manage your API keys", action: () => (window.location.href = "/account") };
  } else if (loggedIn) {
    cta = { label: "Upgrade to API — £19.99/mo", action: onUpgrade };
  } else {
    cta = { label: "Create an account", action: () => (window.location.href = "/register") };
  }

  return (
    <section id="api" className="relative scroll-mt-20 border-y border-border-subtle bg-surface-raised/40">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24">
        <SectionHeading
          kicker="For developers & shops"
          title="Automate prep with the API."
          copy="Bulk-process listings, run pre-grades at scale, or wire GemCheck into your shop. Same engine as the web app."
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
        <p className="mt-4 text-sm text-text-secondary leading-relaxed">
          GemCheck is a pre-check, not an official grade. Official grades are decided by the
          grading company after inspecting the physical card. Estimates are based on what your
          photos can show — fine scratches or dents hidden by glare may not be visible. For
          high-value cards, always inspect by hand too.
        </p>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border-subtle bg-surface-raised/30">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="text-center sm:text-left">
            <img
              src="/gemcheck-logo.png"
              alt="GemCheck"
              className="h-9 w-auto mx-auto sm:mx-0"
              draggable={false}
            />
            <p className="mt-2 text-xs text-text-muted">
              Built with care in the English Lake District
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
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
      </div>
    </footer>
  );
}
