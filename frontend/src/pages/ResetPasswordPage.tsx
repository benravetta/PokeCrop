import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import {
  AuthLayout,
  Field,
  FormError,
  SubmitButton,
} from "../components/auth/AuthLayout";

export function ResetPasswordPage() {
  const { session, updatePassword } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
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
      await updatePassword(password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update password.");
    } finally {
      setLoading(false);
    }
  };

  // The recovery link establishes a session via the URL token. If there's no
  // session, the link is missing/expired.
  if (!session) {
    return (
      <AuthLayout
        title="Reset link needed"
        subtitle="Open the password reset link from your email to continue."
        footer={
          <Link to="/forgot-password" className="text-accent hover:text-accent-hover font-medium">
            Request a new link
          </Link>
        }
      >
        <div />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Choose a new password">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormError message={error} />
        <Field
          label="New password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          required
          autoFocus
        />
        <Field
          label="Confirm new password"
          type="password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          required
        />
        <SubmitButton loading={loading}>Update password</SubmitButton>
      </form>
    </AuthLayout>
  );
}
