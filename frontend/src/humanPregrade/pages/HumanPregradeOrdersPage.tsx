import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { listHumanPregradeOrders, type HumanPregradeOrderSummary } from "../api";
import { HumanPregradeProgress } from "../components/HumanPregradeProgress";
import { resolveCustomerProgress } from "../copy";
import { useHumanPregradeConfig } from "../hooks/useHumanPregradeConfig";

const PAGE_SIZE = 25;
type StatusFilter = "" | "in_progress" | "completed" | "unable_to_assess";

export function HumanPregradeOrdersPage() {
  const { enabled, config } = useHumanPregradeConfig();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("");
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState<HumanPregradeOrderSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listHumanPregradeOrders({
        q: query.trim() || undefined,
        status: status || undefined,
        page,
        pageSize: PAGE_SIZE,
        sort: status === "completed" ? "completed_desc" : "created_desc",
      });
      setOrders(res.orders);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [query, status, page]);

  useEffect(() => {
    if (!enabled) return;
    void load();
  }, [enabled, load]);

  if (!enabled || !config) return <p className="p-8 text-text-muted">Unavailable.</p>;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{config.productName} orders</h1>
        <Link to="/human-pregrade/new" className="text-sm text-accent">New review</Link>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-border-subtle bg-surface text-sm"
            placeholder="Search card name, set, number…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          className="rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as StatusFilter);
            setPage(1);
          }}
        >
          <option value="">All</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Complete</option>
          <option value="unable_to_assess">Unable to assess</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-text-muted">No expert reviews yet.</p>
      ) : (
        <ul className="divide-y divide-border-subtle rounded-xl border border-border-subtle overflow-hidden">
          {orders.map((o) => {
            const progress = o.progress ?? resolveCustomerProgress(o.status);
            return (
              <li key={o.publicId}>
                <Link to={`/human-pregrade/orders/${o.publicId}`} className="block p-4 hover:bg-surface-overlay space-y-2">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium text-sm">{o.cardName ?? "Untitled"}</span>
                    <span className="text-xs text-text-muted shrink-0">
                      {o.completedAt
                        ? new Date(o.completedAt).toLocaleDateString()
                        : o.createdAt
                          ? new Date(o.createdAt).toLocaleDateString()
                          : ""}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted">{o.setName} {o.cardNumber}</p>
                  <HumanPregradeProgress progress={progress} compact />
                  {o.status === "completed" ? (
                    <span className="text-xs text-accent">View report →</span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            disabled={page <= 1}
            className="inline-flex items-center gap-1 disabled:opacity-40"
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          <span className="text-text-muted">
            Page {page} of {totalPages} ({total} total)
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            className="inline-flex items-center gap-1 disabled:opacity-40"
            onClick={() => setPage((p) => p + 1)}
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
