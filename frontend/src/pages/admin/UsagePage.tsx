import { useCallback, useEffect, useState } from "react";
import { Download, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import {
  adminListUsageEvents,
  adminExportUsageEvents,
  type AdminUsageEvent,
} from "../../lib/api";

export function UsagePage() {
  const [kind, setKind] = useState("");
  const [billing, setBilling] = useState("");
  const [source, setSource] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [events, setEvents] = useState<AdminUsageEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminListUsageEvents({
        page,
        kind: kind || undefined,
        billing: billing || undefined,
        source: source || undefined,
        from: from || undefined,
        to: to || undefined,
      });
      setEvents(r.events);
      setTotal(r.total);
      setPageSize(r.pageSize);
    } catch {
      setEvents([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, kind, billing, source, from, to]);

  useEffect(() => {
    const t = window.setTimeout(load, 200);
    return () => window.clearTimeout(t);
  }, [load]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      await adminExportUsageEvents({
        kind: kind || undefined,
        billing: billing || undefined,
        source: source || undefined,
        from: from || undefined,
        to: to || undefined,
      });
    } finally {
      setExporting(false);
    }
  };

  const hasMore = page * pageSize < total;

  return (
    <div className="max-w-5xl mx-auto px-5 py-8">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl font-semibold text-text-primary mb-1">Usage</h1>
          <p className="text-[13px] text-text-secondary">
            Global crop and grade history across all users.
          </p>
        </div>
        <button
          onClick={exportCsv}
          disabled={exporting}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium rounded-lg border border-border-subtle text-text-secondary hover:text-accent transition-colors disabled:opacity-50"
        >
          {exporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Export CSV
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2 mb-4">
        <FilterSelect label="Kind" value={kind} onChange={setKind} options={["", "crop", "grade"]} />
        <FilterSelect
          label="Billing"
          value={billing}
          onChange={setBilling}
          options={["", "free", "subscription", "one_off", "admin"]}
        />
        <FilterSelect label="Source" value={source} onChange={setSource} options={["", "web", "api"]} />
        <FilterInput label="From" type="date" value={from} onChange={setFrom} />
        <FilterInput label="To" type="date" value={to} onChange={setTo} />
      </div>

      <div className="rounded-xl border border-border-subtle overflow-x-auto">
        <table className="w-full text-left min-w-[720px]">
          <thead className="bg-surface-raised text-[11px] uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">Time</th>
              <th className="px-4 py-2.5 font-medium">User</th>
              <th className="px-4 py-2.5 font-medium">Kind</th>
              <th className="px-4 py-2.5 font-medium">Source</th>
              <th className="px-4 py-2.5 font-medium">Billing</th>
              <th className="px-4 py-2.5 font-medium">Summary</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center">
                  <Loader2 className="w-5 h-5 text-accent animate-spin inline" />
                </td>
              </tr>
            ) : events.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[13px] text-text-muted">
                  No usage events match these filters.
                </td>
              </tr>
            ) : (
              events.map((e) => (
                <tr key={e.id} className="border-t border-border-subtle text-[13px]">
                  <td className="px-4 py-3 text-text-muted whitespace-nowrap">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-text-primary truncate max-w-[160px]">
                    {e.email ?? e.userId.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{e.kind}</td>
                  <td className="px-4 py-3 text-text-secondary">{e.source}</td>
                  <td className="px-4 py-3 text-text-secondary">{e.billing}</td>
                  <td className="px-4 py-3 text-text-muted truncate max-w-[200px]">
                    {e.summary ?? "—"}
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
          className="inline-flex items-center gap-1 px-3 py-1.5 text-[13px] text-text-secondary rounded-lg border border-border-subtle hover:text-text-primary disabled:opacity-40"
        >
          <ChevronLeft className="w-4 h-4" /> Prev
        </button>
        <span className="text-[12px] text-text-muted">
          Page {page} · {total.toLocaleString()} total
        </span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={!hasMore || loading}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-[13px] text-text-secondary rounded-lg border border-border-subtle hover:text-text-primary disabled:opacity-40"
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-text-muted uppercase tracking-wide">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg bg-surface-raised border border-border-subtle px-2 py-2 text-[13px] text-text-primary"
      >
        {options.map((o) => (
          <option key={o || "all"} value={o}>
            {o || "All"}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterInput({
  label,
  type,
  value,
  onChange,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-text-muted uppercase tracking-wide">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg bg-surface-raised border border-border-subtle px-2 py-2 text-[13px] text-text-primary"
      />
    </label>
  );
}
