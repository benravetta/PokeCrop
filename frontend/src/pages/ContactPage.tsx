import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { MarketingPageShell } from "../components/marketing/MarketingPageShell";
import { TurnstileField } from "../components/TurnstileWidget";
import { useTurnstileToken } from "../hooks/useTurnstile";
import { submitContactForm } from "../lib/api";
import { SEO } from "../lib/marketingCopy";
import { usePageSeo } from "../lib/seo";

export function ContactPage() {
  usePageSeo(useMemo(() => SEO.contact, []));
  const turnstile = useTurnstileToken();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!turnstile.ready) {
      setError("Complete the security check.");
      return;
    }
    setLoading(true);
    try {
      await submitContactForm({
        name,
        email,
        message,
        turnstileToken: turnstile.token ?? undefined,
      });
      setSent(true);
    } catch (err) {
      turnstile.reset();
      setError(err instanceof Error ? err.message : "Could not send message.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <MarketingPageShell>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent mb-3">Contact</p>
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Talk to GemCheck</h1>
      <p className="mt-4 text-base text-text-secondary leading-relaxed">
        If you have a question, a weird card, or a trade enquiry, send it over. For quick answers,
        try the{" "}
        <Link to="/faq" className="text-accent hover:text-accent-hover font-medium">
          FAQ
        </Link>{" "}
        first.
      </p>

      {sent ? (
        <div className="mt-10 rounded-2xl border border-success/30 bg-success/10 p-5 text-sm text-success">
          Message sent — we will be in touch soon.
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-10 space-y-4">
          {error && (
            <div className="rounded-lg bg-error/10 border border-error/20 px-3 py-2 text-sm text-error">
              {error}
            </div>
          )}
          <label className="block">
            <span className="block text-sm font-medium text-text-primary mb-1.5">Your name</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg bg-surface-overlay border border-border-subtle px-3 py-2.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-text-primary mb-1.5">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-surface-overlay border border-border-subtle px-3 py-2.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-text-primary mb-1.5">
              What do you need help with?
            </span>
            <textarea
              required
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Account help, product question, trade enquiry…"
              className="w-full rounded-lg bg-surface-overlay border border-border-subtle px-3 py-2.5 text-sm resize-y"
            />
            <span className="block mt-1.5 text-xs text-text-muted">
              If it is a trade enquiry, include rough monthly card volume.
            </span>
          </label>
          <TurnstileField {...turnstile} />
          <button
            type="submit"
            disabled={loading || !turnstile.ready}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Send message
          </button>
        </form>
      )}
    </MarketingPageShell>
  );
}
