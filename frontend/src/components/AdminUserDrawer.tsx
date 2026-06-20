import { useEffect, useState } from "react";
import { X, Copy, Check, KeyRound, Trash2, Loader2 } from "lucide-react";
import {
  type AdminUser,
  type AdminApiKey,
  adminSetRole,
  adminSetPlan,
  adminSuspend,
  adminListApiKeys,
  adminCreateApiKey,
  adminRevokeApiKey,
} from "../lib/api";

export function AdminUserDrawer({
  user,
  onClose,
  onChanged,
}: {
  user: AdminUser;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [keys, setKeys] = useState<AdminApiKey[] | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [issuedSecret, setIssuedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadKeys = () => {
    adminListApiKeys(user.id)
      .then((r) => setKeys(r.keys))
      .catch(() => setKeys([]));
  };

  useEffect(() => {
    loadKeys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try {
      await fn();
      onChanged();
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(null);
    }
  };

  const issueKey = async () => {
    setBusy("issue");
    setIssuedSecret(null);
    try {
      const { secret } = await adminCreateApiKey(user.id, newLabel.trim());
      setIssuedSecret(secret);
      setNewLabel("");
      loadKeys();
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(null);
    }
  };

  const copySecret = () => {
    if (!issuedSecret) return;
    navigator.clipboard.writeText(issuedSecret).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 anim-fade" onClick={onClose}>
      <div
        className="w-full max-w-md h-full bg-surface-raised border-l border-border-subtle shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle sticky top-0 bg-surface-raised">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-text-primary truncate">
              {user.email ?? "User"}
            </h2>
            <p className="text-[11px] text-text-muted font-mono truncate">{user.id}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:bg-surface-overlay hover:text-text-primary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-5">
          {/* Role */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-primary font-medium">Admin access</p>
              <p className="text-[12px] text-text-muted">Full management permissions</p>
            </div>
            <button
              onClick={() =>
                run("role", () => adminSetRole(user.id, user.role === "admin" ? "user" : "admin"))
              }
              disabled={busy !== null}
              className={`px-3 py-1.5 text-[13px] font-medium rounded-lg border transition-colors disabled:opacity-60 ${
                user.role === "admin"
                  ? "bg-accent/15 text-accent border-accent/30"
                  : "bg-surface-overlay text-text-secondary border-border-subtle hover:text-text-primary"
              }`}
            >
              {busy === "role" ? "…" : user.role === "admin" ? "Admin" : "Make admin"}
            </button>
          </div>

          {/* Plan */}
          <div>
            <p className="text-sm text-text-primary font-medium mb-1.5">Plan override</p>
            <div className="flex gap-2">
              {(["free", "unlimited", "api"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => run("plan", () => adminSetPlan(user.id, p))}
                  disabled={busy !== null}
                  className={`flex-1 px-2 py-1.5 text-[12.5px] font-medium rounded-lg border transition-colors disabled:opacity-60 ${
                    user.plan === p
                      ? "bg-accent text-white border-accent"
                      : "bg-surface-overlay text-text-secondary border-border-subtle hover:text-text-primary"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            {user.status && (
              <p className="text-[11px] text-text-muted mt-1.5">
                Subscription status: {user.status}
              </p>
            )}
          </div>

          {/* Suspend */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-primary font-medium">Account status</p>
              <p className="text-[12px] text-text-muted">
                {user.suspended ? "Suspended (cannot sign in)" : "Active"}
              </p>
            </div>
            <button
              onClick={() => run("suspend", () => adminSuspend(user.id, !user.suspended))}
              disabled={busy !== null}
              className={`px-3 py-1.5 text-[13px] font-medium rounded-lg border transition-colors disabled:opacity-60 ${
                user.suspended
                  ? "bg-success/15 text-success border-success/30"
                  : "bg-error/10 text-error border-error/30 hover:bg-error/15"
              }`}
            >
              {busy === "suspend" ? "…" : user.suspended ? "Reinstate" : "Suspend"}
            </button>
          </div>

          {/* API keys */}
          <div className="border-t border-border-subtle pt-5">
            <div className="flex items-center gap-2 mb-3">
              <KeyRound className="w-4 h-4 text-accent" />
              <p className="text-sm text-text-primary font-medium">API keys</p>
            </div>

            {issuedSecret && (
              <div className="mb-3 rounded-lg bg-accent/10 border border-accent/20 p-3">
                <p className="text-[11px] text-text-secondary mb-1.5">
                  Copy this key now — it won't be shown again.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-[11px] text-text-primary font-mono break-all">
                    {issuedSecret}
                  </code>
                  <button
                    onClick={copySecret}
                    className="p-1.5 rounded-md bg-surface-overlay hover:bg-border-subtle transition-colors shrink-0"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-success" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-text-secondary" />
                    )}
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-2 mb-3">
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Key label (e.g. Production)"
                className="flex-1 rounded-lg bg-surface-overlay border border-border-subtle px-3 py-2 text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
              <button
                onClick={issueKey}
                disabled={busy !== null}
                className="px-3 py-2 text-[13px] font-medium text-white bg-accent rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-60"
              >
                {busy === "issue" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Issue"}
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {keys === null ? (
                <p className="text-[12px] text-text-muted">Loading…</p>
              ) : keys.length === 0 ? (
                <p className="text-[12px] text-text-muted">No API keys yet.</p>
              ) : (
                keys.map((k) => (
                  <div
                    key={k.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-surface-overlay border border-border-subtle px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] text-text-primary truncate">
                        {k.label || "Unlabeled"}
                        {k.revoked_at && (
                          <span className="ml-2 text-[11px] text-error">revoked</span>
                        )}
                      </p>
                      <p className="text-[11px] text-text-muted font-mono">
                        {k.key_prefix}…
                      </p>
                    </div>
                    {!k.revoked_at && (
                      <button
                        onClick={() =>
                          run("revoke", () => adminRevokeApiKey(k.id).then(loadKeys))
                        }
                        disabled={busy !== null}
                        className="p-1.5 rounded-md text-text-muted hover:bg-error/10 hover:text-error transition-colors shrink-0"
                        title="Revoke key"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
