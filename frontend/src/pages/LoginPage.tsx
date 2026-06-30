import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
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
import { GuestPrimaryCtaLink } from "../components/marketing/GuestPrimaryCtaLink";
import { intentTargetPath, type ToolIntent } from "../hooks/useInviteRequired";

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const intent = (searchParams.get("intent") as ToolIntent | null) ?? null;
  const from = (location.state as { from?: string } | null)?.from ?? intentTargetPath(intent);
  const turnstile = useTurnstileToken();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      await signIn(email, password, turnstile.token ?? undefined);
      navigate(from, { replace: true });
    } catch (err) {
      turnstile.reset();
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle={AUTH.loginSubtitle}
      footer={
        <>
          {AUTH.noAccount}{" "}
          <GuestPrimaryCtaLink
            registerLabel="Create an account"
            intent={intent ?? undefined}
            className="text-accent hover:text-accent-hover font-medium"
          />
        </>
      }
    >
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
        <div>
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            required
          />
          <div className="mt-1.5 text-right">
            <Link
              to="/forgot-password"
              className="text-[12px] text-text-muted hover:text-text-secondary"
            >
              Forgot password?
            </Link>
          </div>
        </div>
        <TurnstileField {...turnstile} />
        <SubmitButton loading={loading} disabled={!turnstile.ready}>
          Sign in
        </SubmitButton>
      </form>
    </AuthLayout>
  );
}
