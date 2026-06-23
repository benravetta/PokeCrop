import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  X,
  Copy,
  Check,
  KeyRound,
  Trash2,
  Loader2,
  Download,
  ShieldCheck,
  Ban,
  CalendarClock,
  Clock,
  Mail,
  Activity,
} from "lucide-react";
import {
  type AdminUser,
  type AdminUserDetail,
  type AdminApiKey,
  type ActivityEvent,
  type PlanStatus,
  adminGetUser,
  adminSetRole,
  adminSetPlan,
  adminSuspend,
  adminSetKeyLimit,
  adminListApiKeys,
  adminCreateApiKey,
  adminRevokeApiKey,
  adminDownloadActivity,
} from "../lib/api";
import type { Plan } from "../lib/plans";

const ACTION_LABEL: Record<string, string> = {
  "crop.web": "Cropped (web)",
  "crop.api": "Cropped (API)",
  "key.created": "API key created",
  "key.revoked": "API key revoked",
  "plan.changed": "Plan changed",
  "role.changed": "Role changed",
  "account.suspended": "Account suspended",
  "account.reinstated": "Account reinstated",
  "key_limit.changed": "Key limit changed",
  "subscription.synced": "Subscription synced",
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.round(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function summarize(ev: ActivityEvent): string {
  const d = ev.detail ?? {};
  const parts: string[] = [];
  if (ev.action === "crop.web" || ev.action === "crop.api") {
    if (d.width && d.height) parts.push(`${String(d.width)}×${String(d.height)}`);
    if (typeof d.filename === "string") parts.push(d.filename);
    if (typeof d.format === "string") parts.push(String(d.format).toUpperCase());
  } else if (ev.action === "plan.changed" || ev.action === "subscription.synced") {
    if (d.plan) parts.push(String(d.plan));
    if (d.status) parts.push(String(d.status));
  } else if (ev.action === "role.changed") {
    if (d.role) parts.push(String(d.role));
  } else if (ev.action === "key.created" || ev.action === "key.revoked") {
    if (typeof d.key_prefix === "string") parts.push(`${d.key_prefix}…`);
    if (typeof d.label === "string" && d.label) parts.push(d.label);
  } else if (ev.action === "key_limit.changed") {
    parts.push(d.max_api_keys == null ? "default" : String(d.max_api_keys));
  }
  return parts.join(" · ");
}

const PLAN_OPTIONS: Plan[] = ["free", "unlimited", "pro", "api"];
const STATUS_OPTIONS: PlanStatus[] = ["active", "trialing", "canceled"];

export function AdminUserDrawer({
  user,
  onClose,
  onChanged,
}: {
  user: AdminUser;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [keys, setKeys] = useState<AdminApiKey[] | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [issuedSecret, setIssuedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [keyLimitInput, setKeyLimitInput] = useState("");

  const loadDetail = useCallback(() => {
    adminGetUser(user.id)
      .then((r) => {
        setDetail(r.user);
        setKeyLimitInput(r.user.max_api_keys == null ? "" : String(r.user.max_api_keys));
      })
      .catch(() => setDetail(null));
  }, [user.id]);

  const loadKeys = useCallback(() => {
    adminListApiKeys(user.id)
      .then((r) => setKeys(r.keys))
      .catch(() => setKeys([]));
  }, [user.id]);

  useEffect(() => {
    loadDetail();
    loadKeys();
  }, [loadDetail, loadKeys]);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try {
      await fn();
      loadDetail();
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
      loadDetail();
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(null);
    }
  };

  const copy = (value: string, which: "secret" | "id") => {
    navigator.clipboard.writeText(value).then(() => {
      if (which === "secret") {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      } else {
        setCopiedId(true);
        window.setTimeout(() => setCopiedId(false), 2000);
      }
    });
  };

  const d = detail;
  const plan = d?.plan ?? user.plan;
  const role = d?.role ?? user.role;
  const suspended = d?.suspended ?? user.suspended;
  const keyLimit = d?.key_limit ?? 10;

  const saveKeyLimit = () =>
    run("limit", () =>
      adminSetKeyLimit(user.id, keyLimitInput.trim() === "" ? null : Number(keyLimitInput))
    );

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 anim-fade" onClick={onClose}>
      <div
        className="w-full max-w-md h-full bg-surface-raised border-l border-border-subtle shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle sticky top-0 bg-surface-raised z-10">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-text-primary truncate">
                {user.email ?? "User"}
              </h2>
              {role === "admin" && (
                <span className="text-[10px] font-semibold text-accent bg-accent/15 px-1.5 py-0.5 rounded shrink-0">
                  ADMIN
                </span>
              )}
              {suspended && (
                <span className="text-[10px] font-semibold text-error bg-error/15 px-1.5 py-0.5 rounded shrink-0">
                  SUSPENDED
                </span>
              )}
            </div>
            <button
              onClick={() => copy(user.id, "id")}
              className="flex items-center gap-1 text-[11px] text-text-muted hover:text-text-secondary font-mono truncate"
              title="Copy user ID"
            >
              {copiedId ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
              {user.id}
            </button>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:bg-surface-overlay hover:text-text-primary transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-5">
          {/* Account info */}
          <div className="grid grid-cols-2 gap-3">
            <InfoCell icon={<CalendarClock className="w-3.5 h-3.5" />} label="Joined" value={fmtDate(d?.created_at ?? user.created_at)} />
            <InfoCell icon={<Clock className="w-3.5 h-3.5" />} label="Last sign in" value={fmtDate(d?.last_sign_in_at)} />
            <InfoCell icon={<Mail className="w-3.5 h-3.5" />} label="Email confirmed" value={d ? (d.email_confirmed_at ? "Yes" : "No") : "…"} />
            <InfoCell icon={<Activity className="w-3.5 h-3.5" />} label="Crops today" value={String(d?.cropsUsedToday ?? user.cropsUsedToday)} />
          </div>

          {/* Role */}
          <Row title="Admin access" sub="Full management permissions">
            <button
              onClick={() => run("role", () => adminSetRole(user.id, role === "admin" ? "user" : "admin"))}
              disabled={busy !== null}
              className={`px-3 py-1.5 text-[13px] font-medium rounded-lg border transition-colors disabled:opacity-60 ${
                role === "admin"
                  ? "bg-accent/15 text-accent border-accent/30"
                  : "bg-surface-overlay text-text-secondary border-border-subtle hover:text-text-primary"
              }`}
            >
              {busy === "role" ? "…" : role === "admin" ? "Revoke admin" : "Make admin"}
            </button>
          </Row>

          {/* Plan */}
          <div>
            <p className="text-sm text-text-primary font-medium mb-1.5">Plan override</p>
            <div className="flex gap-2">
              {PLAN_OPTIONS.map((p) => (
                <button
                  key={p}
                  onClick={() => run("plan", () => adminSetPlan(user.id, p))}
                  disabled={busy !== null}
                  className={`flex-1 px-2 py-1.5 text-[12.5px] font-medium rounded-lg border transition-colors disabled:opacity-60 ${
                    plan === p
                      ? "bg-accent text-white border-accent"
                      : "bg-surface-overlay text-text-secondary border-border-subtle hover:text-text-primary"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[11px] text-text-muted">Status</span>
              <div className="flex gap-1.5">
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => run("status", () => adminSetPlan(user.id, plan as Plan, s))}
                    disabled={busy !== null}
                    className={`px-2 py-0.5 text-[11px] rounded border transition-colors disabled:opacity-60 ${
                      d?.status === s
                        ? "bg-surface-overlay text-text-primary border-border-strong"
                        : "text-text-muted border-border-subtle hover:text-text-secondary"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-text-muted mt-1.5">
              {d?.has_stripe ? "Linked to Stripe" : "Comped — not billed via Stripe"}
              {d?.current_period_end ? ` · renews ${fmtDate(d.current_period_end)}` : ""}
            </p>
          </div>

          {/* Suspend */}
          <Row
            title="Account status"
            sub={suspended ? "Suspended — cannot sign in or use the API" : "Active"}
          >
            <button
              onClick={() => run("suspend", () => adminSuspend(user.id, !suspended))}
              disabled={busy !== null}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-lg border transition-colors disabled:opacity-60 ${
                suspended
                  ? "bg-success/15 text-success border-success/30"
                  : "bg-error/10 text-error border-error/30 hover:bg-error/15"
              }`}
            >
              {busy === "suspend" ? "…" : suspended ? <><ShieldCheck className="w-3.5 h-3.5" /> Reinstate</> : <><Ban className="w-3.5 h-3.5" /> Suspend</>}
            </button>
          </Row>

          {/* Key limit */}
          <div>
            <p className="text-sm text-text-primary font-medium">API key limit</p>
            <p className="text-[12px] text-text-muted mb-2">
              Max active keys (currently {keyLimit}). Leave blank for the default.
            </p>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                max={100}
                value={keyLimitInput}
                onChange={(e) => setKeyLimitInput(e.target.value)}
                placeholder="Default (10)"
                className="flex-1 rounded-lg bg-surface-overlay border border-border-subtle px-3 py-2 text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
              <button
                onClick={saveKeyLimit}
                disabled={busy !== null}
                className="px-3 py-2 text-[13px] font-medium text-text-primary bg-surface-overlay border border-border-subtle rounded-lg hover:text-accent transition-colors disabled:opacity-60"
              >
                {busy === "limit" ? "…" : "Save"}
              </button>
            </div>
          </div>

          {/* API keys */}
          <div className="border-t border-border-subtle pt-5">
            <div className="flex items-center gap-2 mb-3">
              <KeyRound className="w-4 h-4 text-accent" />
              <p className="text-sm text-text-primary font-medium">
                API keys
                {d && <span className="text-text-muted font-normal"> · {d.activeKeys} active</span>}
              </p>
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
                    onClick={() => copy(issuedSecret, "secret")}
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
                        {k.key_prefix}… · {k.last_used_at ? `used ${relTime(k.last_used_at)}` : "never used"}
                      </p>
                    </div>
                    {!k.revoked_at && (
                      <button
                        onClick={() => run("revoke", () => adminRevokeApiKey(k.id).then(loadKeys))}
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

          {/* Activity */}
          <div className="border-t border-border-subtle pt-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-accent" />
                <p className="text-sm text-text-primary font-medium">Recent activity</p>
              </div>
              <button
                onClick={() => adminDownloadActivity(user.id, user.email).catch(console.error)}
                className="inline-flex items-center gap-1 text-[12px] text-text-secondary hover:text-accent transition-colors"
                title="Download the full 2-day log as CSV"
              >
                <Download className="w-3.5 h-3.5" /> Full log
              </button>
            </div>

            {!d ? (
              <p className="text-[12px] text-text-muted">Loading…</p>
            ) : d.activity.length === 0 ? (
              <p className="text-[12px] text-text-muted">No activity in the last 2 days.</p>
            ) : (
              <ul className="flex flex-col">
                {d.activity.map((ev) => {
                  const byOther = ev.actor_id && ev.actor_id !== user.id;
                  const bySystem = !ev.actor_id;
                  return (
                    <li
                      key={ev.id}
                      className="flex items-start gap-3 py-2 border-b border-border-subtle/60 last:border-0"
                    >
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent/60 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] text-text-primary">
                          {ACTION_LABEL[ev.action] ?? ev.action}
                          {summarize(ev) && (
                            <span className="text-text-muted"> · {summarize(ev)}</span>
                          )}
                        </p>
                        <p className="text-[11px] text-text-muted">
                          {relTime(ev.created_at)}
                          {byOther && ` · by ${ev.actor_email ?? "admin"}`}
                          {bySystem && " · by system"}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-text-primary font-medium">{title}</p>
        <p className="text-[12px] text-text-muted">{sub}</p>
      </div>
      {children}
    </div>
  );
}

function InfoCell({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-surface-overlay border border-border-subtle px-3 py-2">
      <div className="flex items-center gap-1.5 text-text-muted mb-0.5">
        {icon}
        <span className="text-[10px] uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-[12.5px] text-text-primary truncate" title={value}>
        {value}
      </p>
    </div>
  );
}
