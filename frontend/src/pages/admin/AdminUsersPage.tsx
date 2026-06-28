import { useCallback, useEffect, useState } from "react";
import { PageContainer } from "../../components/pageLayout";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  MailPlus,
} from "lucide-react";
import {
  adminListUsers,
  adminListInvites,
  adminSendInvite,
  adminResendInvite,
  type AdminUser,
  type AdminInvite,
} from "../../lib/api";
import { AdminUserDrawer } from "../../components/AdminUserDrawer";
import { PLAN_LABELS } from "../../lib/plans";

const PLAN_STYLES: Record<string, string> = {
  free: "bg-surface-overlay text-text-secondary border-border-subtle",
  unlimited: "bg-accent/15 text-accent border-accent/30",
  pro: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  api: "bg-purple-500/15 text-purple-300 border-purple-500/30",
};

type Filter = "all" | "free" | "unlimited" | "pro" | "api" | "admin" | "suspended";
const FILTERS: { key: Filter; param?: Record<string, string> }[] = [
  { key: "all" },
  { key: "free", param: { plan: "free" } },
  { key: "unlimited", param: { plan: "unlimited" } },
  { key: "pro", param: { plan: "pro" } },
  { key: "api", param: { plan: "api" } },
  { key: "admin", param: { role: "admin" } },
  { key: "suspended", param: { suspended: "true" } },
];

export function AdminUsersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"user" | "admin">("user");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [invites, setInvites] = useState<AdminInvite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(true);

  const loadInvites = useCallback(async () => {
    setInvitesLoading(true);
    try {
      const res = await adminListInvites({ page: 1, pageSize: 10 });
      setInvites(res.invites);
    } catch {
      setInvites([]);
    } finally {
      setInvitesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInvites();
  }, [loadInvites]);

  const sendInvite = async () => {
    setInviteMsg(null);
    setInviteSending(true);
    try {
      await adminSendInvite(inviteEmail.trim(), inviteRole);
      setInviteEmail("");
      setInviteMsg("Invitation sent.");
      await loadInvites();
    } catch (err) {
      setInviteMsg(err instanceof Error ? err.message : "Could not send invitation.");
    } finally {
      setInviteSending(false);
    }
  };

  const filter: Filter =
    searchParams.get("suspended") === "true"
      ? "suspended"
      : searchParams.get("role") === "admin"
        ? "admin"
        : (searchParams.get("plan") as Filter) || "all";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const active = FILTERS.find((f) => f.key === filter);
    try {
      const res = await adminListUsers({
        query: query.trim() || undefined,
        page,
        ...active?.param,
      });
      setUsers(res.users);
      setHasMore(res.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, [query, page, filter]);

  useEffect(() => {
    const t = window.setTimeout(load, 250);
    return () => window.clearTimeout(t);
  }, [load]);

  useEffect(() => {
    setSelected((cur) => (cur ? users.find((u) => u.id === cur.id) ?? cur : cur));
  }, [users]);

  const setFilter = (f: Filter) => {
    setPage(1);
    const active = FILTERS.find((x) => x.key === f);
    if (active?.param) {
      setSearchParams(active.param);
    } else {
      setSearchParams({});
    }
  };

  return (
    <PageContainer width="medium">
      <h1 className="text-xl font-semibold text-text-primary mb-1">Users</h1>
      <p className="text-[13px] text-text-secondary mb-5">
        Manage roles, plans, API keys, beta invites and account status.
      </p>

      <div className="rounded-xl border border-border-subtle bg-surface-raised p-4 mb-5">
        <h2 className="text-sm font-medium text-text-primary mb-2 flex items-center gap-2">
          <MailPlus className="w-4 h-4 text-accent" />
          Send beta invite
        </h2>
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="Email address"
            className="flex-1 rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as "user" | "admin")}
            className="rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          <button
            type="button"
            disabled={inviteSending || !inviteEmail.trim()}
            onClick={() => void sendInvite()}
            className="rounded-lg bg-accent text-white px-4 py-2 text-sm font-medium hover:bg-accent-hover disabled:opacity-50"
          >
            {inviteSending ? "Sending…" : "Send invite"}
          </button>
        </div>
        {inviteMsg ? (
          <p className="text-[12px] text-text-secondary mb-2">{inviteMsg}</p>
        ) : null}
        {invitesLoading ? (
          <div className="flex items-center gap-2 text-[12px] text-text-muted">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading invites…
          </div>
        ) : invites.length ? (
          <ul className="divide-y divide-border-subtle text-[12px]">
            {invites.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <div className="text-text-primary truncate">{inv.email}</div>
                  <div className="text-text-muted">
                    {inv.role}
                    {inv.accepted_at
                      ? " · accepted"
                      : new Date(inv.expires_at) < new Date()
                        ? " · expired"
                        : " · pending"}
                  </div>
                </div>
                {!inv.accepted_at ? (
                  <button
                    type="button"
                    onClick={() => {
                      void adminResendInvite(inv.id)
                        .then(() => {
                          setInviteMsg("Invitation resent.");
                          return loadInvites();
                        })
                        .catch((err) =>
                          setInviteMsg(
                            err instanceof Error ? err.message : "Could not resend invitation."
                          )
                        );
                    }}
                    className="shrink-0 text-accent hover:text-accent-hover"
                  >
                    Resend
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12px] text-text-muted">No invites sent yet.</p>
        )}
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input
          value={query}
          onChange={(e) => {
            setPage(1);
            setQuery(e.target.value);
          }}
          placeholder="Search by email…"
          className="w-full rounded-lg bg-surface-raised border border-border-subtle pl-9 pr-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {FILTERS.map(({ key }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-2.5 py-1 text-[12px] rounded-full border capitalize transition-colors ${
              filter === key
                ? "bg-accent/15 text-accent border-accent/30"
                : "text-text-muted border-border-subtle hover:text-text-secondary"
            }`}
          >
            {key}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-error/10 border border-error/20 px-3 py-2 text-[13px] text-error">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-border-subtle overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-surface-raised text-[11px] uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">User</th>
              <th className="px-4 py-2.5 font-medium">Plan</th>
              <th className="px-4 py-2.5 font-medium hidden sm:table-cell">Today</th>
              <th className="px-4 py-2.5 font-medium hidden sm:table-cell">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center">
                  <Loader2 className="w-5 h-5 text-accent animate-spin inline" />
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-[13px] text-text-muted">
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => setSelected(u)}
                  className="border-t border-border-subtle hover:bg-surface-raised cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-text-primary truncate max-w-[200px]">
                        {u.email ?? "—"}
                      </span>
                      {u.role === "admin" && (
                        <span className="text-[10px] font-semibold text-accent bg-accent/15 px-1.5 py-0.5 rounded">
                          ADMIN
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded border ${
                        PLAN_STYLES[u.plan] ?? PLAN_STYLES.free
                      }`}
                    >
                      {PLAN_LABELS[u.plan as keyof typeof PLAN_LABELS] ?? u.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-text-secondary hidden sm:table-cell">
                    {u.cropsUsedToday} crops
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {u.suspended ? (
                      <span className="text-[12px] text-error">Suspended</span>
                    ) : (
                      <span className="text-[12px] text-success">Active</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1 || loading}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-[13px] text-text-secondary rounded-lg border border-border-subtle hover:text-text-primary disabled:opacity-40 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Prev
        </button>
        <span className="text-[12px] text-text-muted">Page {page}</span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={!hasMore || loading}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-[13px] text-text-secondary rounded-lg border border-border-subtle hover:text-text-primary disabled:opacity-40 transition-colors"
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {selected && (
        <AdminUserDrawer
          user={selected}
          onClose={() => setSelected(null)}
          onChanged={load}
        />
      )}
    </PageContainer>
  );
}
