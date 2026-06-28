import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import { TurnstileField } from "../TurnstileWidget";
import { useTurnstileToken } from "../../hooks/useTurnstile";
import { submitInviteRequest } from "../../lib/api";
import { WAITLIST } from "../../lib/marketingCopy";
import { SiteFooter } from "../landing/FooterSections";
import { GuestMarketingHeader } from "../header/GuestMarketingHeader";
import { WaitlistBenefitsPanel } from "./WaitlistBenefitsPanel";
import {
  Field,
  FormError,
  SubmitButton,
} from "../auth/AuthLayout";
import { Wordmark } from "../landing/shared";

function WaitlistFormCard({
  name,
  setName,
  email,
  setEmail,
  message,
  setMessage,
  error,
  loading,
  turnstile,
  onSubmit,
}: {
  name: string;
  setName: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  message: string;
  setMessage: (v: string) => void;
  error: string | null;
  loading: boolean;
  turnstile: ReturnType<typeof useTurnstileToken>;
  onSubmit: (e: FormEvent) => void;
}) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-raised p-6 sm:p-7 shadow-2xl lg:sticky lg:top-24">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-text-primary">{WAITLIST.formTitle}</h2>
        <p className="mt-1 text-[13px] text-text-secondary leading-relaxed">
          {WAITLIST.formSubtitle}
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormError message={error} />
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          required
          autoFocus
        />
        <Field
          label="Name (optional)"
          value={name}
          onChange={setName}
          autoComplete="name"
        />
        <label className="block">
          <span className="block text-[12px] font-medium text-text-secondary mb-1.5">
            What do you collect? (optional)
          </span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="e.g. Pokémon vintage, modern sports, shop inventory"
            className="w-full rounded-lg bg-surface-overlay border border-border-subtle px-3 py-2.5 text-sm text-text-primary
                       placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors resize-y min-h-[5rem]"
          />
        </label>
        <TurnstileField {...turnstile} />
        <SubmitButton loading={loading} disabled={!turnstile.ready}>
          {WAITLIST.submitLabel}
        </SubmitButton>
      </form>
    </div>
  );
}

export function WaitlistLanding() {
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

  const formProps = {
    name,
    setName,
    email,
    setEmail,
    message,
    setMessage,
    error,
    loading,
    turnstile,
    onSubmit,
  };

  if (sent) {
    return (
      <div className="min-h-[100dvh] bg-surface text-text-primary flex flex-col">
        <GuestMarketingHeader />
        <main className="flex-1 flex items-center justify-center px-4 py-12 landing-mesh">
          <div className="w-full max-w-md anim-rise">
            <Link to="/" className="flex justify-center mb-8">
              <Wordmark />
            </Link>
            <div className="rounded-2xl border border-border-subtle bg-surface-raised p-6 sm:p-8 shadow-2xl text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/15">
                <CheckCircle2 className="h-6 w-6 text-accent" />
              </span>
              <h1 className="mt-5 text-xl font-semibold">{WAITLIST.successTitle}</h1>
              <p className="mt-3 text-[13px] text-text-secondary leading-relaxed">
                {WAITLIST.successBody}
              </p>
              <p className="mt-5 text-[13px] text-text-muted">
                Already invited?{" "}
                <Link to="/login" className="text-accent hover:text-accent-hover font-medium">
                  Sign in
                </Link>
              </p>
            </div>
            <p className="mt-5 text-center">
              <Link to="/" className="text-[13px] text-text-muted hover:text-text-secondary">
                Back to homepage
              </Link>
            </p>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-surface text-text-primary flex flex-col">
      <GuestMarketingHeader />

      <main className="flex-1 landing-mesh border-b border-border-subtle">
        <div className="mx-auto w-full max-w-5xl page-x py-10 sm:py-14">
          <div className="grid gap-8 lg:grid-cols-2 lg:gap-10 lg:items-start">
            <WaitlistFormCard {...formProps} />
            <WaitlistBenefitsPanel />
          </div>

          {WAITLIST.faq.length > 0 ? (
            <section className="mt-12 pt-10 border-t border-border-subtle">
              <h2 className="text-sm font-semibold text-text-primary">Common questions</h2>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                {WAITLIST.faq.map((item) => (
                  <div
                    key={item.q}
                    className="rounded-xl border border-border-subtle bg-surface-raised/80 p-4"
                  >
                    <dt className="text-[13px] font-semibold text-text-primary">{item.q}</dt>
                    <dd className="mt-1.5 text-[13px] text-text-secondary leading-relaxed">
                      {item.a}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
