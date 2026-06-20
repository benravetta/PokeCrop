import { useCallback, useEffect, useState } from "react";
import { Search, Loader2, ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";
import { adminListUsers, type AdminUser } from "../lib/api";
import { AdminUserDrawer } from "../components/AdminUserDrawer";

const PLAN_STYLES: Record<string, string> = {
  free: "bg-surface-overlay text-text-secondary border-border-subtle",
  unlimited: "bg-accent/15 text-accent border-accent/30",
  api: "bg-purple-500/15 text-purple-300 border-purple-500/30",
};

export function AdminPage() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminUser | null>(null);

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

  useEffect(() => {
    const t = window.setTimeout(load, 250);
    return () => window.clearTimeout(t);
  }, [load]);

  // Keep the open detail drawer in sync with refreshed list data.
  useEffect(() => {
    setSelected((cur) => (cur ? users.find((u) => u.id === cur.id) ?? cur : cur));
  }, [users]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-5 py-8">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="w-5 h-5 text-accent" />
          <h1 className="text-xl font-semibold text-text-primary">Admin</h1>
        </div>
        <p className="text-[13px] text-text-secondary mb-5">
          Manage users, plans and API keys.
        </p>

        <div className="relative mb-4">
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
                        {u.plan}
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
          onChanged={load}
        />
      )}
    </div>
  );
}
