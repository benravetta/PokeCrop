import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  Infinity as InfinityIcon,
  KeyRound,
  Ban,
  Scissors,
  GraduationCap,
  CreditCard,
  AlertTriangle,
  PoundSterling,
  Loader2,
} from "lucide-react";
import {
  adminGetStats,
  adminGetAiSpend,
  adminGetRevenueOverview,
  type AdminStats,
  type AiSpend,
  type RevenueOverview,
} from "../../lib/api";
import { AdminStatCard } from "../../components/admin/AdminStatCard";
import { AiSpendPanel } from "../../components/admin/AiSpendPanel";

function gbp(n: number): string {
  return `£${n.toFixed(2)}`;
}

export function AdminOverviewPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [spend, setSpend] = useState<AiSpend | null>(null);
  const [revenue, setRevenue] = useState<RevenueOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      adminGetStats().then((r) => setStats(r.stats)),
      adminGetAiSpend(30).then((r) => setSpend(r.spend)),
      adminGetRevenueOverview(30).then((r) => setRevenue(r.overview)),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const alerts: { label: string; to: string; count: number }[] = [];
  if (revenue) {
    if (revenue.pastDueSubscriptions > 0) {
      alerts.push({
        label: "Past due subscriptions",
        to: "/admin/revenue?tab=failures",
        count: revenue.pastDueSubscriptions,
      });
    }
    if (revenue.failedInvoices > 0) {
      alerts.push({
        label: "Open invoices",
        to: "/admin/revenue?tab=failures",
        count: revenue.failedInvoices,
      });
    }
    if (revenue.disputedPurchases > 0) {
      alerts.push({
        label: "Disputed purchases",
        to: "/admin/revenue?tab=failures",
        count: revenue.disputedPurchases,
      });
    }
  }
  if (stats && stats.suspended > 0) {
    alerts.push({
      label: "Suspended accounts",
      to: "/admin/users?suspended=true",
      count: stats.suspended,
    });
  }

  return (
    <div className="max-w-5xl mx-auto px-5 py-8">
      <h1 className="text-xl font-semibold text-text-primary mb-1">Overview</h1>
      <p className="text-[13px] text-text-secondary mb-6">
        Users, usage, revenue and operational alerts at a glance.
      </p>

      {loading && !stats ? (
        <div className="py-16 text-center">
          <Loader2 className="w-6 h-6 text-accent animate-spin inline" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
            <AdminStatCard icon={<Users className="w-4 h-4" />} label="Users" value={stats?.users_total} />
            <AdminStatCard
              icon={<InfinityIcon className="w-4 h-4" />}
              label="Premium"
              value={stats?.unlimited_active}
            />
            <AdminStatCard icon={<KeyRound className="w-4 h-4" />} label="Pro" value={stats?.pro_active} />
            <AdminStatCard icon={<KeyRound className="w-4 h-4" />} label="Enterprise" value={stats?.api_active} />
            <AdminStatCard
              icon={<Ban className="w-4 h-4" />}
              label="Suspended"
              value={stats?.suspended}
              tone={stats?.suspended ? "error" : undefined}
            />
            <AdminStatCard
              icon={<Scissors className="w-4 h-4" />}
              label="Crops today"
              value={stats ? stats.crops_web_today + stats.crops_api_today : undefined}
            />
            <AdminStatCard icon={<GraduationCap className="w-4 h-4" />} label="Grades today" value={stats?.grades_today} />
            <AdminStatCard
              icon={<CreditCard className="w-4 h-4" />}
              label="Grade credits"
              value={stats?.grade_credits_outstanding}
            />
          </div>

          {revenue && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <AdminStatCard
                icon={<PoundSterling className="w-4 h-4" />}
                label="MRR estimate"
                value={gbp(revenue.mrrEstimateGbp)}
                sub="From active plan prices"
              />
              <AdminStatCard
                icon={<InfinityIcon className="w-4 h-4" />}
                label="Active subs"
                value={revenue.activeSubscriptions}
              />
              <AdminStatCard
                icon={<CreditCard className="w-4 h-4" />}
                label="One-off (30d)"
                value={gbp(revenue.oneOffRevenueGbp)}
                sub={`${revenue.oneOffPurchases} purchases`}
              />
              <AdminStatCard
                icon={<AlertTriangle className="w-4 h-4" />}
                label="Failed / disputed"
                value={revenue.failedInvoices + revenue.disputedPurchases}
                tone={
                  revenue.failedInvoices + revenue.disputedPurchases > 0 ? "error" : undefined
                }
              />
            </div>
          )}

          {!revenue?.stripeConfigured && (
            <div className="mb-6 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-[13px] text-amber-200">
              Stripe is not configured. Revenue KPIs show local purchase data only.
            </div>
          )}

          {alerts.length > 0 && (
            <div className="mb-6 rounded-xl border border-border-subtle bg-surface-raised p-4">
              <p className="text-sm font-medium text-text-primary mb-2">Alerts</p>
              <ul className="flex flex-col gap-2">
                {alerts.map((a) => (
                  <li key={a.label}>
                    <Link
                      to={a.to}
                      className="flex items-center justify-between text-[13px] text-text-secondary hover:text-accent transition-colors"
                    >
                      <span>{a.label}</span>
                      <span className="font-semibold tabular-nums text-text-primary">{a.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <AiSpendPanel spend={spend} days={30} />
        </>
      )}
    </div>
  );
}
