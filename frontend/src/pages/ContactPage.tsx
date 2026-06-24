import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { MarketingPageShell } from "../components/marketing/MarketingPageShell";
import { SEO } from "../lib/marketingCopy";

export function ContactPage() {
  const [sent, setSent] = useState(false);

  useEffect(() => {
    document.title = SEO.contact.title;
  }, []);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSent(true);
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
          <label className="block">
            <span className="block text-sm font-medium text-text-primary mb-1.5">Your name</span>
            <input
              required
              className="w-full rounded-lg bg-surface-overlay border border-border-subtle px-3 py-2.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-text-primary mb-1.5">Email</span>
            <input
              type="email"
              required
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
              placeholder="Account help, product question, trade enquiry…"
              className="w-full rounded-lg bg-surface-overlay border border-border-subtle px-3 py-2.5 text-sm resize-y"
            />
            <span className="block mt-1.5 text-xs text-text-muted">
              If it is a trade enquiry, include rough monthly card volume.
            </span>
          </label>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent-hover transition-colors"
          >
            Send message
          </button>
        </form>
      )}
    </MarketingPageShell>
  );
}
