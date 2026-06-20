import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import {
  AuthLayout,
  Field,
  FormError,
  SubmitButton,
} from "../components/auth/AuthLayout";

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to crop your cards."
      footer={
        <>
          New to CardCrop?{" "}
          <Link to="/register" className="text-accent hover:text-accent-hover font-medium">
            Create an account
          </Link>
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
        <SubmitButton loading={loading}>Sign in</SubmitButton>
      </form>
    </AuthLayout>
  );
}
