import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import {
  adminGetAiSpend,
  adminListFormSubmissions,
  adminListStripeEvents,
  adminGetRevenueOverview,
  type AiSpend,
  type FormSubmission,
  type StripeEventLog,
  type RevenueOverview,
} from "../../lib/api";
import { AiSpendPanel } from "../../components/admin/AiSpendPanel";

export function OperationsPage() {
  const [spend, setSpend] = useState<AiSpend | null>(null);
  const [overview, setOverview] = useState<RevenueOverview | null>(null);
  const [forms, setForms] = useState<FormSubmission[]>([]);
  const [events, setEvents] = useState<StripeEventLog[]>([]);
  const [formsPage, setFormsPage] = useState(1);
  const [eventsPage, setEventsPage] = useState(1);
  const [formsTotal, setFormsTotal] = useState(0);
  const [formsPageSize, setFormsPageSize] = useState(25);
  const [eventsTotal, setEventsTotal] = useState(0);
  const [eventsPageSize, setEventsPageSize] = useState(50);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminGetAiSpend(30)
      .then((r) => setSpend(r.spend))
      .catch(() => setSpend(null));
    adminGetRevenueOverview(30)
      .then((r) => setOverview(r.overview))
      .catch(() => setOverview(null));
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      adminListFormSubmissions({ page: formsPage }).then((r) => {
        setForms(r.submissions);
        setFormsTotal(r.total);
        setFormsPageSize(r.pageSize);
      }),
      adminListStripeEvents({ page: eventsPage }).then((r) => {
        setEvents(r.events);
        setEventsTotal(r.total);
        setEventsPageSize(r.pageSize);
      }),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [formsPage, eventsPage]);

  const alerts = [
    overview && overview.pastDueSubscriptions > 0
      ? `${overview.pastDueSubscriptions} past due subscription(s)`
      : null,
    overview && overview.failedInvoices > 0 ? `${overview.failedInvoices} open invoice(s)` : null,
    overview && overview.disputedPurchases > 0
      ? `${overview.disputedPurchases} disputed purchase(s)`
      : null,
  ].filter(Boolean) as string[];

  return (
    <div className="max-w-5xl mx-auto px-5 py-8">
      <h1 className="text-xl font-semibold text-text-primary mb-1">Operations</h1>
      <p className="text-[13px] text-text-secondary mb-6">
        Form inbox, webhook log, AI spend and payment alerts.
      </p>

      {alerts.length > 0 && (
        <div className="mb-6 rounded-xl border border-error/20 bg-error/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-error" />
            <p className="text-sm font-medium text-text-primary">Alerts</p>
          </div>
          <ul className="flex flex-col gap-1.5">
            {alerts.map((a) => (
              <li key={a}>
                <Link to="/admin/revenue?tab=failures" className="text-[13px] text-accent hover:underline">
                  {a}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-8">
        <AiSpendPanel spend={spend} days={30} />
      </div>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-text-primary mb-3">Form inbox</h2>
        {loading && forms.length === 0 ? (
          <Loader2 className="w-5 h-5 text-accent animate-spin" />
        ) : (
          <>
            <div className="rounded-xl border border-border-subtle overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-surface-raised text-[11px] uppercase tracking-wide text-text-muted">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Time</th>
                    <th className="px-4 py-2.5 font-medium">Kind</th>
                    <th className="px-4 py-2.5 font-medium">Email</th>
                    <th className="px-4 py-2.5 font-medium">Payload</th>
                  </tr>
                </thead>
                <tbody>
                  {forms.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-[13px] text-text-muted">
                        No submissions yet.
                      </td>
                    </tr>
                  ) : (
                    forms.map((f) => (
                      <tr key={f.id} className="border-t border-border-subtle text-[13px]">
                        <td className="px-4 py-3 text-text-muted whitespace-nowrap">
                          {new Date(f.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-text-secondary">{f.kind}</td>
                        <td className="px-4 py-3 text-text-primary">{f.email ?? "—"}</td>
                        <td className="px-4 py-3 text-text-muted font-mono text-[11px] truncate max-w-[280px]">
                          {JSON.stringify(f.payload)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pager page={formsPage} total={formsTotal} pageSize={formsPageSize} onChange={setFormsPage} />
          </>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-text-primary mb-3">Stripe webhook log</h2>
        <div className="rounded-xl border border-border-subtle overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-surface-raised text-[11px] uppercase tracking-wide text-text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Time</th>
                <th className="px-4 py-2.5 font-medium">Event ID</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-[13px] text-text-muted">
                    No webhook events logged.
                  </td>
                </tr>
              ) : (
                events.map((e) => (
                  <tr key={e.id} className="border-t border-border-subtle text-[13px]">
                    <td className="px-4 py-3 text-text-muted whitespace-nowrap">
                      {new Date(e.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-text-secondary">{e.id}</td>
                    <td className="px-4 py-3 text-text-primary">{e.type}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pager page={eventsPage} total={eventsTotal} pageSize={eventsPageSize} onChange={setEventsPage} />
      </section>
    </div>
  );
}

function Pager({
  page,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  onChange: (p: number) => void;
}) {
  const hasMore = page * pageSize < total;
  return (
    <div className="flex items-center justify-between mt-3">
      <button
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-[13px] text-text-secondary rounded-lg border border-border-subtle disabled:opacity-40"
      >
        <ChevronLeft className="w-4 h-4" /> Prev
      </button>
      <span className="text-[12px] text-text-muted">Page {page}</span>
      <button
        onClick={() => onChange(page + 1)}
        disabled={!hasMore}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-[13px] text-text-secondary rounded-lg border border-border-subtle disabled:opacity-40"
      >
        Next <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
