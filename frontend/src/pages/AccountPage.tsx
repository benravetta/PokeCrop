import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { User as UserIcon, CreditCard, Lock, Check, Loader2, Sparkles, KeyRound, History } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useMe } from "../hooks/useMe";
import { supabase } from "../lib/supabase";
import { openBillingPortal, startGradeCheckout, getGradeQuota, type GradeQuota } from "../lib/api";
import { Field } from "../components/auth/AuthLayout";
import { ApiKeysPanel } from "../components/ApiKeysPanel";

function Section({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border-subtle bg-surface-raised p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-7 h-7 rounded-lg bg-accent/15 text-accent flex items-center justify-center">
          {icon}
        </span>
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
      </div>
      {children}
    </section>
  );
}

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  unlimited: "Unlimited",
  api: "API access",
};

export function AccountPage() {
  const { user, updatePassword } = useAuth();
  const { me, refresh } = useMe();
  const [searchParams, setSearchParams] = useSearchParams();
  const [portalBusy, setPortalBusy] = useState(false);
  const [buyBusy, setBuyBusy] = useState(false);
  const [gradeQuota, setGradeQuota] = useState<GradeQuota | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaved, setPwSaved] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const checkoutStatus = searchParams.get("checkout");

  useEffect(() => {
    refresh();
    getGradeQuota()
      .then((r) => setGradeQuota(r.quota))
      .catch(() => {});
  }, [refresh]);

  // Returning from Stripe Checkout: refresh plan, then strip the query param.
  useEffect(() => {
    if (checkoutStatus) {
      refresh();
      const t = window.setTimeout(() => {
        searchParams.delete("checkout");
        setSearchParams(searchParams, { replace: true });
      }, 4000);
      return () => window.clearTimeout(t);
    }
  }, [checkoutStatus, refresh, searchParams, setSearchParams]);

  const openPortal = async () => {
    setPortalBusy(true);
    try {
      const url = await openBillingPortal();
      window.location.href = url;
    } catch {
      setPortalBusy(false);
    }
  };

  const buyGrade = async () => {
    setBuyBusy(true);
    try {
      const url = await startGradeCheckout();
      window.location.href = url;
    } catch {
      setBuyBusy(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.display_name) setDisplayName(data.display_name);
      });
  }, [user]);

  const saveName = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingName(true);
    setNameSaved(false);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim() || null })
      .eq("id", user.id);
    setSavingName(false);
    if (!error) {
      setNameSaved(true);
      window.setTimeout(() => setNameSaved(false), 2500);
    }
  };

  const savePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSaved(false);
    if (password.length < 8) {
      setPwError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setPwError("Passwords do not match.");
      return;
    }
    setSavingPw(true);
    try {
      await updatePassword(password);
      setPassword("");
      setConfirm("");
      setPwSaved(true);
      window.setTimeout(() => setPwSaved(false), 2500);
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Could not update password.");
    } finally {
      setSavingPw(false);
    }
  };

  const plan = me?.plan ?? "free";

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-5 py-8 flex flex-col gap-5">
        <h1 className="text-xl font-semibold text-text-primary">Account</h1>

        <Section icon={<UserIcon className="w-4 h-4" />} title="Profile">
          <form onSubmit={saveName} className="flex flex-col gap-4">
            <div>
              <span className="block text-[12px] font-medium text-text-secondary mb-1.5">
                Email
              </span>
              <input
                value={user?.email ?? ""}
                disabled
                className="w-full rounded-lg bg-surface-overlay/60 border border-border-subtle px-3 py-2.5 text-sm text-text-muted"
              />
            </div>
            <Field label="Display name" value={displayName} onChange={setDisplayName} />
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={savingName}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                {savingName ? "Saving…" : "Save"}
              </button>
              {nameSaved && (
                <span className="inline-flex items-center gap-1 text-[12px] text-success">
                  <Check className="w-3.5 h-3.5" /> Saved
                </span>
              )}
            </div>
          </form>
        </Section>

        <Section icon={<CreditCard className="w-4 h-4" />} title="Plan &amp; billing">
          {checkoutStatus === "success" && (
            <div className="mb-4 rounded-lg bg-success/10 border border-success/20 px-3 py-2 text-[13px] text-success">
              Thanks! Your subscription is active.
            </div>
          )}
          {checkoutStatus === "cancel" && (
            <div className="mb-4 rounded-lg bg-surface-overlay border border-border-subtle px-3 py-2 text-[13px] text-text-secondary">
              Checkout cancelled — no changes were made.
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-text-primary font-medium">
                {PLAN_LABELS[plan] ?? plan} plan
              </p>
              <p className="text-[12px] text-text-muted mt-0.5">
                {plan === "free"
                  ? me
                    ? `${me.cropsRemaining ?? 0} of 3 daily crops remaining`
                    : "3 crops per day"
                  : "Unlimited crops"}
              </p>
              {gradeQuota && (
                <p className="text-[12px] text-text-muted mt-0.5">
                  {gradeQuota.allowanceRemaining} of {gradeQuota.limit} AI grades remaining{" "}
                  {gradeQuota.window === "month" ? "this month" : "today"}
                  {gradeQuota.credits > 0 && (
                    <span className="text-accent"> · +{gradeQuota.credits} purchased</span>
                  )}
                </p>
              )}
            </div>
            {plan === "free" ? (
              <Link
                to="/pricing"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent-hover transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                Upgrade
              </Link>
            ) : (
              <button
                onClick={openPortal}
                disabled={portalBusy}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-text-primary bg-surface-overlay border border-border-subtle rounded-lg hover:bg-border-subtle transition-colors disabled:opacity-60"
              >
                {portalBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Manage billing"}
              </button>
            )}
          </div>

          {/* One-off grade purchase — no subscription needed. */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
            <div>
              <p className="text-sm text-text-primary font-medium">Single grade</p>
              <p className="text-[12px] text-text-muted mt-0.5">
                Buy one AI grade for £2.99 — no subscription. Added to your account instantly.
              </p>
            </div>
            <button
              onClick={buyGrade}
              disabled={buyBusy}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-accent bg-accent/10 border border-accent/40 rounded-lg hover:bg-accent/20 transition-colors disabled:opacity-60"
            >
              {buyBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
              Buy 1 grade — £2.99
            </button>
          </div>
        </Section>

        <Section icon={<History className="w-4 h-4" />} title="History">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-text-secondary">
              View and search every crop and grade on your account, with dates, billing and quota usage.
            </p>
            <Link
              to="/history"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-text-primary bg-surface-overlay border border-border-subtle rounded-lg hover:bg-border-subtle transition-colors"
            >
              <History className="w-4 h-4" />
              View history
            </Link>
          </div>
        </Section>

        {plan === "api" && (
          <Section icon={<KeyRound className="w-4 h-4" />} title="API keys">
            <ApiKeysPanel />
          </Section>
        )}

        <Section icon={<Lock className="w-4 h-4" />} title="Change password">
          <form onSubmit={savePassword} className="flex flex-col gap-4">
            {pwError && (
              <div className="rounded-lg bg-error/10 border border-error/20 px-3 py-2 text-[13px] text-error">
                {pwError}
              </div>
            )}
            <Field
              label="New password"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
            />
            <Field
              label="Confirm new password"
              type="password"
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
            />
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={savingPw}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                {savingPw ? "Updating…" : "Update password"}
              </button>
              {pwSaved && (
                <span className="inline-flex items-center gap-1 text-[12px] text-success">
                  <Check className="w-3.5 h-3.5" /> Updated
                </span>
              )}
            </div>
          </form>
        </Section>
      </div>
    </div>
  );
}
