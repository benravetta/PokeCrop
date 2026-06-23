import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Users,
  Infinity as InfinityIcon,
  KeyRound,
  Ban,
  Scissors,
  DollarSign,
} from "lucide-react";
import {
  adminListUsers,
  adminGetStats,
  adminGetAiSpend,
  type AdminUser,
  type AdminStats,
  type AiSpend,
} from "../lib/api";
import { AdminUserDrawer } from "../components/AdminUserDrawer";
import { PLAN_LABELS } from "../lib/plans";

const PLAN_STYLES: Record<string, string> = {
  free: "bg-surface-overlay text-text-secondary border-border-subtle",
  unlimited: "bg-accent/15 text-accent border-accent/30",
  pro: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  api: "bg-purple-500/15 text-purple-300 border-purple-500/30",
};

type Filter = "all" | "free" | "unlimited" | "pro" | "api" | "admin" | "suspended";
const FILTERS: Filter[] = ["all", "free", "unlimited", "pro", "api", "admin", "suspended"];

export function AdminPage() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [spend, setSpend] = useState<AiSpend | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminListUsers({ query: query.trim() || undefined, page });
      setUsers(res.users);
      setHasMore(res.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, [query, page]);

  const loadStats = useCallback(() => {
    adminGetStats()
      .then((r) => setStats(r.stats))
      .catch(() => setStats(null));
  }, []);

  useEffect(() => {
    const t = window.setTimeout(load, 250);
    return () => window.clearTimeout(t);
  }, [load]);

  useEffect(() => {
    loadStats();
    adminGetAiSpend(30)
      .then((r) => setSpend(r.spend))
      .catch(() => setSpend(null));
  }, [loadStats]);

  // Keep the open detail drawer in sync with refreshed list data.
  useEffect(() => {
    setSelected((cur) => (cur ? users.find((u) => u.id === cur.id) ?? cur : cur));
  }, [users]);

  const visible = useMemo(() => {
    if (filter === "all") return users;
    if (filter === "admin") return users.filter((u) => u.role === "admin");
    if (filter === "suspended") return users.filter((u) => u.suspended);
    return users.filter((u) => u.plan === filter);
  }, [users, filter]);

  const onChanged = useCallback(() => {
    load();
    loadStats();
  }, [load, loadStats]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-5 py-8">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="w-5 h-5 text-accent" />
          <h1 className="text-xl font-semibold text-text-primary">Admin</h1>
        </div>
        <p className="text-[13px] text-text-secondary mb-5">
          Manage users, roles, plans, API keys and activity.
        </p>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <StatCard icon={<Users className="w-4 h-4" />} label="Users" value={stats?.users_total} />
          <StatCard icon={<InfinityIcon className="w-4 h-4" />} label="Premium" value={stats?.unlimited_active} />
          <StatCard icon={<KeyRound className="w-4 h-4" />} label="Enterprise" value={stats?.api_active} />
          <StatCard icon={<Ban className="w-4 h-4" />} label="Suspended" value={stats?.suspended} tone={stats?.suspended ? "error" : undefined} />
          <StatCard icon={<Scissors className="w-4 h-4" />} label="Crops today" value={stats ? stats.crops_web_today + stats.crops_api_today : undefined} />
          <StatCard icon={<KeyRound className="w-4 h-4" />} label="Active keys" value={stats?.active_keys} />
        </div>

        {/* AI spend (token-exact, last 30 days) */}
        {spend && (
          <div className="mb-6 rounded-xl border border-border-subtle bg-surface-raised p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-2 text-sm text-text-secondary">
                <DollarSign className="w-4 h-4 text-accent" />
                AI spend (30 days)
              </span>
              <span className="text-lg font-semibold text-text-primary tabular-nums">
                ${spend.total_cost_usd.toFixed(2)}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-text-muted">
              <span>{spend.total_calls.toLocaleString()} calls</span>
              {spend.by_feature.map((f) => (
                <span key={f.feature}>
                  {f.feature}: <span className="text-text-secondary">${f.cost_usd.toFixed(2)}</span> ({f.calls})
                </span>
              ))}
            </div>
          </div>
        )}

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

        {/* Filters */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 text-[12px] rounded-full border capitalize transition-colors ${
                filter === f
                  ? "bg-accent/15 text-accent border-accent/30"
                  : "text-text-muted border-border-subtle hover:text-text-secondary"
              }`}
            >
              {f}
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
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-[13px] text-text-muted">
                    No users found.
                  </td>
                </tr>
              ) : (
                visible.map((u) => (
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
      </div>

      {selected && (
        <AdminUserDrawer
          user={selected}
          onClose={() => setSelected(null)}
          onChanged={onChanged}
        />
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number | undefined;
  tone?: "error";
}) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-raised px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-text-muted mb-1">
        {icon}
        <span className="text-[10px] uppercase tracking-wide">{label}</span>
      </div>
      <p
        className={`text-lg font-semibold tabular-nums ${
          tone === "error" && value ? "text-error" : "text-text-primary"
        }`}
      >
        {value === undefined ? "—" : value.toLocaleString()}
      </p>
    </div>
  );
}
