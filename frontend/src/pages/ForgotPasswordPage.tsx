import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { MailCheck } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import {
  AuthLayout,
  Field,
  FormError,
  SubmitButton,
} from "../components/auth/AuthLayout";

export function ForgotPasswordPage() {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await sendPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle={sent ? undefined : "We'll email you a link to set a new password."}
      footer={
        <Link to="/login" className="text-accent hover:text-accent-hover font-medium">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="flex flex-col items-center text-center gap-3">
          <span className="w-12 h-12 rounded-full bg-accent/15 flex items-center justify-center">
            <MailCheck className="w-6 h-6 text-accent" />
          </span>
          <p className="text-[13px] text-text-secondary leading-relaxed">
            If an account exists for{" "}
            <span className="text-text-primary font-medium">{email}</span>, a reset
            link is on its way.
          </p>
        </div>
      ) : (
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
          <SubmitButton loading={loading}>Send reset link</SubmitButton>
        </form>
      )}
    </AuthLayout>
  );
}
