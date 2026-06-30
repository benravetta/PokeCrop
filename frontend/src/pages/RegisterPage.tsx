import { useState, useEffect, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { MailCheck, Loader2 } from "lucide-react";
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
import { validateInviteToken, getAuthConfig } from "../lib/api";
import { intentTargetPath, type ToolIntent } from "../hooks/useInviteRequired";

export function RegisterPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const intent = (searchParams.get("intent") as ToolIntent | null) ?? null;
  const turnstile = useTurnstileToken();
  const inviteParam = searchParams.get("invite")?.trim() ?? "";

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [inviteRequired, setInviteRequired] = useState<boolean | null>(null);
  const [inviteValid, setInviteValid] = useState<boolean | null>(
    inviteParam ? null : true
  );
  const [inviteMasked, setInviteMasked] = useState<string | null>(null);

  useEffect(() => {
    getAuthConfig()
      .then((cfg) => setInviteRequired(cfg.inviteRequired))
      .catch(() => setInviteRequired(true));
  }, []);

  useEffect(() => {
    if (inviteRequired === true && !inviteParam) {
      navigate("/request-access", { replace: true });
    }
  }, [inviteRequired, inviteParam, navigate]);

  useEffect(() => {
    if (!inviteParam) {
      setInviteValid(true);
      return;
    }
    let cancelled = false;
    validateInviteToken(inviteParam)
      .then((data) => {
        if (cancelled) return;
        setInviteValid(data.valid);
        if (data.valid && data.emailMasked) setInviteMasked(data.emailMasked);
      })
      .catch(() => {
        if (!cancelled) setInviteValid(false);
      });
    return () => {
      cancelled = true;
    };
  }, [inviteParam]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (inviteRequired === true && (!inviteParam || inviteValid !== true)) {
      setError("Registration requires a valid invitation link.");
      return;
    }
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
        turnstile.token ?? undefined,
        inviteParam || undefined
      );
      if (needsConfirmation) {
        setSentTo(email);
      } else {
        navigate(intentTargetPath(intent), { replace: true });
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
          <Link
            to={intent ? `/login?intent=${intent}` : "/login"}
            className="text-accent hover:text-accent-hover font-medium"
          >
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

  if (inviteRequired === null || (inviteParam && inviteValid === null)) {
    return (
      <AuthLayout title="Create your account" subtitle="Loading…">
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 text-accent animate-spin" />
        </div>
      </AuthLayout>
    );
  }

  if (inviteRequired === true && (!inviteParam || inviteValid === false)) {
    return (
      <AuthLayout
        title="Invitation required"
        subtitle="GemCheck is in invite-only beta."
        footer={
          <>
            Already have an account?{" "}
            <Link
              to={intent ? `/login?intent=${intent}` : "/login"}
              className="text-accent hover:text-accent-hover font-medium"
            >
              Sign in
            </Link>
          </>
        }
      >
        <p className="text-[13px] text-text-secondary leading-relaxed">
          You need a valid invitation link to create an account. If you were invited,
          open the link from your email or ask an admin to resend your invitation.
        </p>
        <p className="text-[13px] text-text-secondary mt-4">
          Don&apos;t have an invite?{" "}
          <Link to="/request-access" className="text-accent hover:text-accent-hover font-medium">
            Join waitlist
          </Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle={
        inviteMasked
          ? `Invited as ${inviteMasked}. Use that email address to register.`
          : AUTH.registerSubtitle
      }
      aside={<RegisterBenefitsPanel />}
      footer={
        <>
          {AUTH.alreadyHaveAccount}{" "}
          <Link
            to={intent ? `/login?intent=${intent}` : "/login"}
            className="text-accent hover:text-accent-hover font-medium"
          >
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
