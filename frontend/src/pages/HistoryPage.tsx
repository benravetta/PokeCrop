import { useCallback, useEffect, useState } from "react";
import {
  History as HistoryIcon,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Crop as CropIcon,
  ShieldCheck,
  ImageOff,
} from "lucide-react";
import { getHistory, type UsageEvent } from "../lib/api";
import { centringLabel } from "../lib/centringDisplay";

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

function usageLabel(e: UsageEvent): string {
  if (e.billing === "one_off") {
    const left = e.remaining_after;
    return left != null
      ? `Purchased credit · ${left} credit${left === 1 ? "" : "s"} left`
      : "Purchased credit";
  }
  if (e.used_after == null)
    return e.plan === "api" || e.plan === "unlimited" || e.plan === "pro" ? "Unlimited" : "—";

  const when =
    e.quota_window === "month" ? "this month" : e.quota_window === "day" ? "today" : "";
  const noun = e.kind === "grade" ? "grade" : "crop";
  const leftTxt =
    e.remaining_after != null ? ` · ${e.remaining_after} left ${when}`.trimEnd() : "";
  return `#${e.used_after} ${noun}${when ? ` ${when}` : ""}${leftTxt}`;
}

function cropDetect(e: UsageEvent): string | null {
  const p = e.detail?.pipeline_confidence;
  if (typeof p !== "number") return null;
  return `${Math.round(p * 100)}%`;
}

function cropCentring(e: UsageEvent): string {
  const c = e.detail?.centring;
  if (c && typeof c === "object") {
    return centringLabel(c as import("../lib/api").CropCentring);
  }
  return "—";
}

function cropDims(e: UsageEvent): string | null {
  const w = e.detail?.width;
  const h = e.detail?.height;
  if (typeof w === "number" && typeof h === "number") return `${w}×${h}px`;
  return null;
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
          Every crop and grade — billing, quota, detect confidence, centring scores and dimensions.
        </p>

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

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 text-accent animate-spin" />
          </div>
        ) : events.length === 0 ? (
          <p className="py-16 text-center text-[13px] text-text-muted">No history yet.</p>
        ) : (
          <ul className="divide-y divide-border-subtle rounded-xl border border-border-subtle bg-surface-raised overflow-hidden">
            {events.map((e) => (
              <li key={e.id} className="flex gap-3 p-3 sm:p-4 hover:bg-surface-overlay/40 transition-colors">
                {e.kind === "crop" ? (
                  <div className="w-12 h-16 shrink-0 rounded-lg border border-border-subtle bg-surface-overlay overflow-hidden flex items-center justify-center">
                    {e.thumbnailUrl ? (
                      <img
                        src={e.thumbnailUrl}
                        alt=""
                        className="w-full h-full object-contain checkerboard"
                      />
                    ) : (
                      <ImageOff className="w-4 h-4 text-text-muted" />
                    )}
                  </div>
                ) : (
                  <div className="w-12 h-16 shrink-0 rounded-lg border border-border-subtle bg-accent/10 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-accent" />
                  </div>
                )}

                <div className="min-w-0 flex-1 grid sm:grid-cols-[1fr_auto] gap-x-4 gap-y-1">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-text-primary truncate">
                        {e.kind === "crop" && typeof e.detail?.card_name === "string"
                          ? String(e.detail.card_name)
                          : e.summary || "—"}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-text-muted capitalize">
                        {e.kind === "grade" ? (
                          <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                        ) : (
                          <CropIcon className="w-3.5 h-3.5" />
                        )}
                        {e.kind}
                        {e.source === "api" && " · API"}
                      </span>
                    </div>
                    {e.kind === "crop" && e.summary && typeof e.detail?.card_name === "string" && (
                      <div className="text-xs text-text-muted truncate">{e.summary}</div>
                    )}
                    {e.kind === "grade" && e.detail?.likely ? (
                      <div className="text-xs text-text-muted">{String(e.detail.likely)}</div>
                    ) : null}
                    <div className="text-[11px] text-text-muted mt-0.5">{fmtDate(e.created_at)}</div>
                  </div>

                  <div className="text-xs text-text-secondary sm:text-right space-y-0.5">
                    <div>
                      <span
                        className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded border mr-1.5 ${
                          BILLING_STYLES[e.billing] ?? BILLING_STYLES.free
                        }`}
                      >
                        {BILLING_LABELS[e.billing] ?? e.billing}
                      </span>
                      {usageLabel(e)}
                    </div>
                    {e.kind === "crop" && (
                      <>
                        {cropDetect(e) && (
                          <div>
                            Detect{" "}
                            <span className="text-text-primary font-medium">{cropDetect(e)}</span>
                          </div>
                        )}
                        <div>
                          Centring{" "}
                          <span className="text-text-primary font-medium">{cropCentring(e)}</span>
                        </div>
                        {cropDims(e) && (
                          <div className="text-text-muted">{cropDims(e)}</div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

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
