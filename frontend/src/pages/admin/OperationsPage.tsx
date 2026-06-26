import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, ChevronLeft, ChevronRight, AlertTriangle, Check, X } from "lucide-react";
import {
  adminGetAiSpend,
  adminListFormSubmissions,
  adminListStripeEvents,
  adminGetRevenueOverview,
  adminGetBetaSettings,
  adminSetBetaSettings,
  adminListInviteRequests,
  adminApproveInviteRequest,
  adminRejectInviteRequest,
  type AiSpend,
  type FormSubmission,
  type StripeEventLog,
  type RevenueOverview,
  type AdminInviteRequest,
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

  const [inviteRequired, setInviteRequired] = useState<boolean | null>(null);
  const [betaSaving, setBetaSaving] = useState(false);
  const [betaMsg, setBetaMsg] = useState<string | null>(null);

  const [requests, setRequests] = useState<AdminInviteRequest[]>([]);
  const [requestsPage, setRequestsPage] = useState(1);
  const [requestsTotal, setRequestsTotal] = useState(0);
  const [requestsPageSize, setRequestsPageSize] = useState(25);
  const [requestsStatus, setRequestsStatus] = useState<"pending" | "approved" | "rejected" | "all">(
    "pending"
  );
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    adminGetAiSpend(30)
      .then((r) => setSpend(r.spend))
      .catch(() => setSpend(null));
    adminGetRevenueOverview(30)
      .then((r) => setOverview(r.overview))
      .catch(() => setOverview(null));
    adminGetBetaSettings()
      .then((r) => setInviteRequired(r.inviteRequired))
      .catch(() => setInviteRequired(null));
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

  useEffect(() => {
    setRequestsLoading(true);
    adminListInviteRequests({ page: requestsPage, status: requestsStatus })
      .then((r) => {
        setRequests(r.requests);
        setRequestsTotal(r.total);
        setRequestsPageSize(r.pageSize);
      })
      .catch(() => setRequests([]))
      .finally(() => setRequestsLoading(false));
  }, [requestsPage, requestsStatus]);

  const onToggleInviteRequired = async () => {
    if (inviteRequired === null || betaSaving) return;
    setBetaSaving(true);
    setBetaMsg(null);
    try {
      const next = !inviteRequired;
      const r = await adminSetBetaSettings(next);
      setInviteRequired(r.inviteRequired);
      const base = next ? "Invite-only mode enabled." : "Public registration enabled.";
      setBetaMsg(
        r.supabaseSignupSynced
          ? `${base} Supabase direct signups updated.`
          : `${base} Set SUPABASE_ACCESS_TOKEN on the server to sync Supabase signups.`
      );
    } catch (err) {
      setBetaMsg(err instanceof Error ? err.message : "Could not update beta settings.");
    } finally {
      setBetaSaving(false);
    }
  };

  const removeRequestFromList = (id: string) => {
    setRequests((prev) => prev.filter((r) => r.id !== id));
    setRequestsTotal((t) => Math.max(0, t - 1));
  };

  const markRequestReviewed = (id: string, status: "approved" | "rejected") => {
    if (requestsStatus === "all") {
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status, reviewedAt: new Date().toISOString() } : r))
      );
      return;
    }
    removeRequestFromList(id);
  };

  const onApprove = async (id: string) => {
    setActionId(id);
    try {
      await adminApproveInviteRequest(id);
      markRequestReviewed(id, "approved");
      setBetaMsg("Invitation sent.");
    } catch (err) {
      setBetaMsg(err instanceof Error ? err.message : "Could not approve request.");
    } finally {
      setActionId(null);
    }
  };

  const onReject = async (id: string) => {
    setActionId(id);
    try {
      await adminRejectInviteRequest(id);
      markRequestReviewed(id, "rejected");
    } catch (err) {
      setBetaMsg(err instanceof Error ? err.message : "Could not reject request.");
    } finally {
      setActionId(null);
    }
  };

  const alerts = [
    overview && overview.pastDueSubscriptions > 0
      ? `${overview.pastDueSubscriptions} past due subscription(s)`
      : null,
    overview && overview.failedInvoices > 0 ? `${overview.failedInvoices} open invoice(s)` : null,
    overview && overview.disputedPurchases > 0
      ? `${overview.disputedPurchases} disputed purchase(s)`
      : null,
    requestsStatus === "pending" && requestsTotal > 0
      ? `${requestsTotal} pending beta access request(s)`
      : null,
  ].filter(Boolean) as string[];

  return (
    <div className="max-w-5xl mx-auto px-5 py-8">
      <h1 className="text-xl font-semibold text-text-primary mb-1">Operations</h1>
      <p className="text-[13px] text-text-secondary mb-6">
        Beta access, form inbox, webhook log, AI spend and payment alerts.
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
                {a.includes("beta access") ? (
                  <button
                    type="button"
                    onClick={() => {
                      setRequestsStatus("pending");
                      setRequestsPage(1);
                    }}
                    className="text-[13px] text-accent hover:underline"
                  >
                    {a}
                  </button>
                ) : (
                  <Link to="/admin/revenue?tab=failures" className="text-[13px] text-accent hover:underline">
                    {a}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="mb-8 rounded-xl border border-border-subtle p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Beta access mode</h2>
            <p className="text-[12px] text-text-muted mt-1">
              When invite-only is on, new signups need an invitation or approved access request.
              Toggle off to open public registration for launch.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void onToggleInviteRequired()}
            disabled={inviteRequired === null || betaSaving}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
              inviteRequired ? "bg-accent" : "bg-border-subtle"
            }`}
            aria-pressed={inviteRequired ?? false}
            aria-label="Toggle invite-only registration"
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                inviteRequired ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
        {inviteRequired !== null ? (
          <p className="text-[12px] text-text-secondary mt-3">
            Status:{" "}
            <span className="font-medium text-text-primary">
              {inviteRequired ? "Invite-only (beta)" : "Open registration"}
            </span>
          </p>
        ) : null}
        {betaMsg ? <p className="text-[12px] text-text-secondary mt-2">{betaMsg}</p> : null}
      </section>

      <section className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold text-text-primary">Beta access requests</h2>
          <select
            value={requestsStatus}
            onChange={(e) => {
              setRequestsStatus(e.target.value as typeof requestsStatus);
              setRequestsPage(1);
            }}
            className="rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-[13px] text-text-primary"
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="all">All</option>
          </select>
        </div>
        {requestsLoading && requests.length === 0 ? (
          <Loader2 className="w-5 h-5 text-accent animate-spin" />
        ) : (
          <>
            <div className="rounded-xl border border-border-subtle overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-surface-raised text-[11px] uppercase tracking-wide text-text-muted">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Time</th>
                    <th className="px-4 py-2.5 font-medium">Email</th>
                    <th className="px-4 py-2.5 font-medium">Name</th>
                    <th className="px-4 py-2.5 font-medium">Message</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {requests.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-[13px] text-text-muted">
                        No access requests.
                      </td>
                    </tr>
                  ) : (
                    requests.map((r) => (
                      <tr key={r.id} className="border-t border-border-subtle text-[13px]">
                        <td className="px-4 py-3 text-text-muted whitespace-nowrap">
                          {new Date(r.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-text-primary">{r.email}</td>
                        <td className="px-4 py-3 text-text-secondary">{r.name ?? "—"}</td>
                        <td className="px-4 py-3 text-text-muted max-w-[220px] truncate">
                          {r.message ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-text-secondary capitalize">{r.status}</td>
                        <td className="px-4 py-3">
                          {r.status === "pending" ? (
                            <div className="flex items-center gap-2 justify-end">
                              <button
                                type="button"
                                disabled={actionId === r.id}
                                onClick={() => void onApprove(r.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-accent/30 text-accent text-[12px] hover:bg-accent/5 disabled:opacity-50"
                              >
                                {actionId === r.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Check className="w-3 h-3" />
                                )}
                                Approve
                              </button>
                              <button
                                type="button"
                                disabled={actionId === r.id}
                                onClick={() => void onReject(r.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border-subtle text-text-secondary text-[12px] hover:bg-surface-raised disabled:opacity-50"
                              >
                                <X className="w-3 h-3" /> Reject
                              </button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pager
              page={requestsPage}
              total={requestsTotal}
              pageSize={requestsPageSize}
              onChange={setRequestsPage}
            />
          </>
        )}
      </section>

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
