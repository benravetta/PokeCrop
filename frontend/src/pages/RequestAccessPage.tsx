import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import { MarketingPageShell } from "../components/marketing/MarketingPageShell";
import { TurnstileField } from "../components/TurnstileWidget";
import { useTurnstileToken } from "../hooks/useTurnstile";
import { getInviteRequestsEnabled, submitInviteRequest } from "../lib/api";
import { SEO } from "../lib/marketingCopy";
import { usePageSeo } from "../lib/seo";

export function RequestAccessPage() {
  usePageSeo(useMemo(() => SEO.requestAccess, []));
  const turnstile = useTurnstileToken();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getInviteRequestsEnabled()
      .then((r) => setEnabled(r.enabled))
      .catch(() => setLoadFailed(true));
  }, []);

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
    } catch (err) {
      turnstile.reset();
      setError(err instanceof Error ? err.message : "Could not submit request.");
    } finally {
      setLoading(false);
    }
  };

  if (loadFailed) {
    return (
      <MarketingPageShell>
        <div className="max-w-lg">
          <h1 className="text-3xl font-semibold tracking-tight">Could not load page</h1>
          <p className="mt-4 text-base text-text-secondary leading-relaxed">
            Try again in a moment or go to{" "}
            <Link to="/register" className="text-accent hover:underline">
              registration
            </Link>
            .
          </p>
        </div>
      </MarketingPageShell>
    );
  }

  if (enabled === null) {
    return (
      <MarketingPageShell>
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 text-accent animate-spin" />
        </div>
      </MarketingPageShell>
    );
  }

  if (!enabled) {
    return (
      <MarketingPageShell>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent mb-3">
          Request access
        </p>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Registration is open</h1>
        <p className="mt-4 text-base text-text-secondary leading-relaxed">
          GemCheck is not in invite-only mode right now. You can create an account directly.
        </p>
        <Link
          to="/register"
          className="inline-flex mt-6 px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover"
        >
          Create account
        </Link>
      </MarketingPageShell>
    );
  }

  if (sent) {
    return (
      <MarketingPageShell>
        <div className="max-w-lg">
          <span className="w-12 h-12 rounded-full bg-accent/15 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-6 h-6 text-accent" />
          </span>
          <h1 className="text-3xl font-semibold tracking-tight">Request received</h1>
          <p className="mt-4 text-base text-text-secondary leading-relaxed">
            Thanks — we&apos;ll review your request and email you an invitation if approved.
          </p>
          <Link to="/login" className="inline-block mt-6 text-sm text-accent hover:underline">
            Back to sign in
          </Link>
        </div>
      </MarketingPageShell>
    );
  }

  return (
    <MarketingPageShell>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent mb-3">
        Request access
      </p>
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Join the GemCheck beta</h1>
      <p className="mt-4 text-base text-text-secondary leading-relaxed max-w-2xl">
        GemCheck is invite-only during beta. Tell us a bit about yourself and we&apos;ll review your
        request. If approved, you&apos;ll receive an email with a registration link.
      </p>

      <form onSubmit={onSubmit} className="mt-8 max-w-lg flex flex-col gap-4">
        {error ? (
          <p className="text-[13px] text-error rounded-lg border border-error/20 bg-error/5 px-3 py-2">
            {error}
          </p>
        ) : null}
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-text-primary">Name (optional)</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-border-subtle bg-surface px-3 py-2 text-[14px] text-text-primary"
            autoComplete="name"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-text-primary">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="rounded-lg border border-border-subtle bg-surface px-3 py-2 text-[14px] text-text-primary"
            autoComplete="email"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-text-primary">
            Why do you want access? (optional)
          </span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="rounded-lg border border-border-subtle bg-surface px-3 py-2 text-[14px] text-text-primary resize-y"
          />
        </label>
        <TurnstileField {...turnstile} />
        <button
          type="submit"
          disabled={loading || !turnstile.ready}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Submit request
        </button>
      </form>
    </MarketingPageShell>
  );
}
