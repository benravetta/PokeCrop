import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MailCheck } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useTurnstileToken } from "../hooks/useTurnstile";
import { TurnstileField } from "../components/TurnstileWidget";
import {
  AuthLayout,
  Field,
  FormError,
  SubmitButton,
} from "../components/auth/AuthLayout";
import { AUTH } from "../lib/marketingCopy";
import { RegisterBenefitsPanel } from "../components/auth/RegisterBenefitsPanel";

export function RegisterPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const turnstile = useTurnstileToken();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!turnstile.ready) {
      setError("Complete the security check.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const { needsConfirmation } = await signUp(
        email,
        password,
        displayName.trim() || undefined,
        turnstile.token ?? undefined
      );
      if (needsConfirmation) {
        setSentTo(email);
      } else {
        navigate("/crop", { replace: true });
      }
    } catch (err) {
      turnstile.reset();
      setError(err instanceof Error ? err.message : "Could not create account.");
    } finally {
      setLoading(false);
    }
  };

  if (sentTo) {
    return (
      <AuthLayout
        title="Confirm your email"
        footer={
          <Link to="/login" className="text-accent hover:text-accent-hover font-medium">
            Back to sign in
          </Link>
        }
      >
        <div className="flex flex-col items-center text-center gap-3">
          <span className="w-12 h-12 rounded-full bg-accent/15 flex items-center justify-center">
            <MailCheck className="w-6 h-6 text-accent" />
          </span>
          <p className="text-[13px] text-text-secondary leading-relaxed">
            We've sent a confirmation link to{" "}
            <span className="text-text-primary font-medium">{sentTo}</span>. Click it
            to activate your account, then sign in.
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle={AUTH.registerSubtitle}
      aside={<RegisterBenefitsPanel />}
      footer={
        <>
          {AUTH.alreadyHaveAccount}{" "}
          <Link to="/login" className="text-accent hover:text-accent-hover font-medium">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormError message={error} />
        <Field
          label="Name (optional)"
          value={displayName}
          onChange={setDisplayName}
          autoComplete="name"
          placeholder="Ash Ketchum"
        />
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          required
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          required
        />
        <Field
          label="Confirm password"
          type="password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          required
        />
        <TurnstileField {...turnstile} />
        <p className="text-[12px] text-text-muted leading-relaxed">
          By creating an account you agree to our{" "}
          <Link to="/terms" className="text-accent hover:text-accent-hover">
            Terms of service
          </Link>{" "}
          and{" "}
          <Link to="/privacy" className="text-accent hover:text-accent-hover">
            Privacy policy
          </Link>
          .
        </p>
        <SubmitButton loading={loading} disabled={!turnstile.ready}>
          Create account
        </SubmitButton>
      </form>
    </AuthLayout>
  );
}
