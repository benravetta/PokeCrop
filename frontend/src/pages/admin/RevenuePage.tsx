import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  PoundSterling,
  Infinity as InfinityIcon,
  CreditCard,
  AlertTriangle,
} from "lucide-react";
import {
  adminGetRevenueOverview,
  adminGetRevenuePurchases,
  adminGetRevenueSubscriptions,
  adminGetRevenueInvoices,
  adminGetRevenueFailures,
  adminGetAiSpend,
  type RevenueOverview,
  type AdminPurchase,
  type AdminSubscription,
  type AdminInvoice,
  type AdminFailure,
  type AiSpend,
} from "../../lib/api";
import { AdminStatCard } from "../../components/admin/AdminStatCard";
import { PLAN_LABELS } from "../../lib/plans";

type Tab = "purchases" | "subscriptions" | "invoices" | "failures";

function gbp(n: number): string {
  return `£${n.toFixed(2)}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function RevenuePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") as Tab) || "purchases";

  const [overview, setOverview] = useState<RevenueOverview | null>(null);
  const [spend, setSpend] = useState<AiSpend | null>(null);
  const [purchases, setPurchases] = useState<AdminPurchase[]>([]);
  const [subscriptions, setSubscriptions] = useState<AdminSubscription[]>([]);
  const [invoices, setInvoices] = useState<AdminInvoice[]>([]);
  const [failures, setFailures] = useState<AdminFailure[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminGetRevenueOverview(30)
      .then((r) => setOverview(r.overview))
      .catch(() => setOverview(null));
    adminGetAiSpend(30)
      .then((r) => setSpend(r.spend))
      .catch(() => setSpend(null));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [tab]);

  useEffect(() => {
    setLoading(true);
    const load = async () => {
      try {
        if (tab === "purchases") {
          const r = await adminGetRevenuePurchases({ page });
          setPurchases(r.purchases);
          setHasMore(r.page * r.pageSize < r.total);
        } else if (tab === "subscriptions") {
          const r = await adminGetRevenueSubscriptions({ page });
          setSubscriptions(r.subscriptions);
          setHasMore(r.page * r.pageSize < r.total);
        } else if (tab === "invoices") {
          const r = await adminGetRevenueInvoices({ page });
          setInvoices(r.invoices);
          setHasMore(r.hasMore);
        } else {
          const r = await adminGetRevenueFailures(30);
          setFailures(r.failures);
          setHasMore(false);
        }
      } catch {
        setPurchases([]);
        setSubscriptions([]);
        setInvoices([]);
        setFailures([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tab, page]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "purchases", label: "Purchases" },
    { id: "subscriptions", label: "Subscriptions" },
    { id: "invoices", label: "Invoices" },
    { id: "failures", label: "Failures" },
  ];

  return (
    <div className="max-w-5xl mx-auto px-5 py-8">
      <h1 className="text-xl font-semibold text-text-primary mb-1">Revenue</h1>
      <p className="text-[13px] text-text-secondary mb-5">
        Stripe-backed subscriptions, one-off grade purchases and payment failures.
      </p>

      {overview && !overview.stripeConfigured && (
        <div className="mb-4 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-[13px] text-amber-200">
          Stripe is not configured. Showing local purchase data only.
        </div>
      )}

      {overview && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          <AdminStatCard
            icon={<PoundSterling className="w-4 h-4" />}
            label="MRR estimate"
            value={gbp(overview.mrrEstimateGbp)}
          />
          <AdminStatCard
            icon={<InfinityIcon className="w-4 h-4" />}
            label="Active subs"
            value={overview.activeSubscriptions}
          />
          <AdminStatCard
            icon={<CreditCard className="w-4 h-4" />}
            label="One-off (30d)"
            value={gbp(overview.oneOffRevenueGbp)}
          />
          <AdminStatCard
            icon={<AlertTriangle className="w-4 h-4" />}
            label="Failed payments"
            value={overview.failedInvoices + overview.pastDueSubscriptions}
            tone={
              overview.failedInvoices + overview.pastDueSubscriptions > 0 ? "error" : undefined
            }
          />
          <AdminStatCard
            icon={<PoundSterling className="w-4 h-4" />}
            label="AI cost (30d)"
            value={spend ? `$${spend.total_cost_usd.toFixed(2)}` : "—"}
            sub="Margin context"
          />
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 mb-4 border-b border-border-subtle pb-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setSearchParams({ tab: t.id })}
            className={`px-3 py-1.5 text-[13px] rounded-lg transition-colors ${
              tab === t.id
                ? "bg-accent/15 text-accent font-medium"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <Loader2 className="w-6 h-6 text-accent animate-spin inline" />
        </div>
      ) : tab === "purchases" ? (
        <DataTable
          headers={["Date", "User", "Qty", "Amount", "Status", "Stripe"]}
          rows={purchases.map((p) => [
            fmtDate(p.creditedAt),
            p.email ?? p.userId.slice(0, 8),
            String(p.qty),
            gbp(p.amountGbp),
            p.status,
            p.stripeSessionUrl ? (
              <a
                key="link"
                href={p.stripeSessionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-accent hover:underline"
              >
                Session <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              "—"
            ),
          ])}
        />
      ) : tab === "subscriptions" ? (
        <DataTable
          headers={["User", "Plan", "Status", "Renews", "Billing", "Stripe"]}
          rows={subscriptions.map((s) => [
            s.email ?? s.userId.slice(0, 8),
            PLAN_LABELS[s.plan as keyof typeof PLAN_LABELS] ?? s.plan,
            s.status ?? "—",
            fmtDate(s.currentPeriodEnd),
            s.comped ? "Comped" : "Paid",
            s.stripeCustomerUrl ? (
              <a
                key="link"
                href={s.stripeCustomerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-accent hover:underline"
              >
                Customer <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              "—"
            ),
          ])}
        />
      ) : tab === "invoices" ? (
        <DataTable
          headers={["Date", "Customer", "Amount", "Status", "Invoice"]}
          rows={invoices.map((i) => [
            fmtDate(i.createdAt),
            i.customerEmail ?? i.customerId ?? "—",
            gbp(i.amountDueGbp),
            i.status ?? "—",
            i.hostedUrl ? (
              <a
                key="link"
                href={i.hostedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-accent hover:underline"
              >
                View <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              "—"
            ),
          ])}
        />
      ) : (
        <DataTable
          headers={["Kind", "Date", "User", "Amount", "Status", "Link"]}
          rows={failures.map((f) => [
            f.kind,
            fmtDate(f.createdAt),
            f.email ?? f.userId?.slice(0, 8) ?? "—",
            f.amountGbp != null ? gbp(f.amountGbp) : "—",
            f.status,
            f.url ? (
              <a
                key="link"
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-accent hover:underline"
              >
                Open <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              "—"
            ),
          ])}
        />
      )}

      {tab !== "failures" && (
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-[13px] text-text-secondary rounded-lg border border-border-subtle hover:text-text-primary disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" /> Prev
          </button>
          <span className="text-[12px] text-text-muted">Page {page}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasMore || loading}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-[13px] text-text-secondary rounded-lg border border-border-subtle hover:text-text-primary disabled:opacity-40"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="rounded-xl border border-border-subtle overflow-x-auto">
      <table className="w-full text-left min-w-[640px]">
        <thead className="bg-surface-raised text-[11px] uppercase tracking-wide text-text-muted">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-2.5 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-4 py-10 text-center text-[13px] text-text-muted">
                No records.
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} className="border-t border-border-subtle text-[13px] text-text-secondary">
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-3">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
