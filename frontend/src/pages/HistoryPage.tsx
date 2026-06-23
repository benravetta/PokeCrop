import { useCallback, useEffect, useState } from "react";
import {
  History as HistoryIcon,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Crop as CropIcon,
  ShieldCheck,
} from "lucide-react";
import { getHistory, type UsageEvent } from "../lib/api";

type KindFilter = "all" | "crop" | "grade";
const KIND_FILTERS: KindFilter[] = ["all", "grade", "crop"];

const BILLING_LABELS: Record<string, string> = {
  free: "Free",
  subscription: "Subscription",
  one_off: "One-off",
};
const BILLING_STYLES: Record<string, string> = {
  free: "bg-surface-overlay text-text-secondary border-border-subtle",
  subscription: "bg-accent/15 text-accent border-accent/30",
  one_off: "bg-purple-500/15 text-purple-300 border-purple-500/30",
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// Human-readable quota usage for a single event, capturing the number used and
// what remained at the time (the key ask for subscription grades).
function usageLabel(e: UsageEvent): string {
  if (e.billing === "one_off") {
    const left = e.remaining_after;
    return left != null
      ? `Purchased credit · ${left} credit${left === 1 ? "" : "s"} left`
      : "Purchased credit";
  }
  // Unlimited crops/grades on paid plans record no per-window number.
  if (e.used_after == null) return e.plan === "api" || e.plan === "unlimited" ? "Unlimited" : "—";

  const when =
    e.quota_window === "month" ? "this month" : e.quota_window === "day" ? "today" : "";
  const noun = e.kind === "grade" ? "grade" : "crop";
  const leftTxt =
    e.remaining_after != null ? ` · ${e.remaining_after} left ${when}`.trimEnd() : "";
  return `#${e.used_after} ${noun}${when ? ` ${when}` : ""}${leftTxt}`;
}

const PAGE_SIZE = 25;

export function HistoryPage() {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const [events, setEvents] = useState<UsageEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getHistory({
        kind: kind === "all" ? undefined : kind,
        q: query.trim() || undefined,
        from: from || undefined,
        // `to` is exclusive on the backend; bump to end-of-day so the chosen day is included.
        to: to ? `${to}T23:59:59.999Z` : undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      setEvents(res.events);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history.");
    } finally {
      setLoading(false);
    }
  }, [kind, query, from, to, page]);

  // Debounce so typing in search / changing dates doesn't spam the API.
  useEffect(() => {
    const t = window.setTimeout(load, 250);
    return () => window.clearTimeout(t);
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-5 py-8">
        <div className="flex items-center gap-2 mb-1">
          <HistoryIcon className="w-5 h-5 text-accent" />
          <h1 className="text-xl font-semibold text-text-primary">History</h1>
        </div>
        <p className="text-[13px] text-text-secondary mb-5">
          Every crop and grade on your account, with dates, how it was paid for, and your quota at
          the time.
        </p>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            value={query}
            onChange={(e) => {
              setPage(1);
              setQuery(e.target.value);
            }}
            placeholder="Search by card name or file…"
            className="w-full rounded-lg bg-surface-raised border border-border-subtle pl-9 pr-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex flex-wrap gap-1.5">
            {KIND_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => {
                  setPage(1);
                  setKind(f);
                }}
                className={`px-2.5 py-1 text-[12px] rounded-full border capitalize transition-colors ${
                  kind === f
                    ? "bg-accent/15 text-accent border-accent/30"
                    : "text-text-muted border-border-subtle hover:text-text-secondary"
                }`}
              >
                {f === "all" ? "All" : `${f}s`}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-[12px] text-text-muted">
            <label className="flex items-center gap-1.5">
              From
              <input
                type="date"
                value={from}
                onChange={(e) => {
                  setPage(1);
                  setFrom(e.target.value);
                }}
                className="rounded-lg bg-surface-raised border border-border-subtle px-2 py-1 text-text-primary focus:outline-none focus:border-accent"
              />
            </label>
            <label className="flex items-center gap-1.5">
              To
              <input
                type="date"
                value={to}
                onChange={(e) => {
                  setPage(1);
                  setTo(e.target.value);
                }}
                className="rounded-lg bg-surface-raised border border-border-subtle px-2 py-1 text-text-primary focus:outline-none focus:border-accent"
              />
            </label>
            {(from || to) && (
              <button
                onClick={() => {
                  setPage(1);
                  setFrom("");
                  setTo("");
                }}
                className="text-text-muted hover:text-text-secondary underline"
              >
                Clear
              </button>
            )}
          </div>
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
                <th className="px-4 py-2.5 font-medium">When</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Item</th>
                <th className="px-4 py-2.5 font-medium hidden sm:table-cell">Billing</th>
                <th className="px-4 py-2.5 font-medium hidden md:table-cell">Quota at the time</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center">
                    <Loader2 className="w-5 h-5 text-accent animate-spin inline" />
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-[13px] text-text-muted">
                    No history yet.
                  </td>
                </tr>
              ) : (
                events.map((e) => (
                  <tr key={e.id} className="border-t border-border-subtle">
                    <td className="px-4 py-3 text-[13px] text-text-secondary whitespace-nowrap">
                      {fmtDate(e.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-[13px] text-text-primary capitalize">
                        {e.kind === "grade" ? (
                          <ShieldCheck className="w-4 h-4 text-accent" />
                        ) : (
                          <CropIcon className="w-4 h-4 text-text-muted" />
                        )}
                        {e.kind}
                        {e.source === "api" && (
                          <span className="text-[10px] font-medium text-text-muted bg-surface-overlay px-1.5 py-0.5 rounded">
                            API
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-text-primary">
                      <span className="block truncate max-w-[260px]">{e.summary || "—"}</span>
                      {e.kind === "grade" && e.detail?.likely ? (
                        <span className="text-[11px] text-text-muted">
                          {String(e.detail.likely)}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span
                        className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded border ${
                          BILLING_STYLES[e.billing] ?? BILLING_STYLES.free
                        }`}
                      >
                        {BILLING_LABELS[e.billing] ?? e.billing}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-text-secondary hidden md:table-cell">
                      {usageLabel(e)}
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
          <span className="text-[12px] text-text-muted">
            Page {page} of {totalPages}
            {total > 0 && ` · ${total.toLocaleString()} total`}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages || loading}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-[13px] text-text-secondary rounded-lg border border-border-subtle hover:text-text-primary disabled:opacity-40 transition-colors"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
