import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { UserCheck } from "lucide-react";
import { listHumanPregradeOrders } from "../api";
import { HumanPregradeProgress } from "./HumanPregradeProgress";
import { resolveCustomerProgress } from "../copy";
import { useHumanPregradeConfig, formatMinorUnits } from "../hooks/useHumanPregradeConfig";

export function HumanPregradePromo({
  aiReportSnapshot,
  cardHints,
}: {
  aiReportSnapshot?: Record<string, unknown>;
  cardHints?: { cardName?: string; setName?: string; cardNumber?: string };
}) {
  const { enabled, config } = useHumanPregradeConfig();
  if (!enabled || !config) return null;

  const params = new URLSearchParams();
  if (cardHints?.cardName) params.set("cardName", cardHints.cardName);
  if (cardHints?.setName) params.set("setName", cardHints.setName);
  if (cardHints?.cardNumber) params.set("cardNumber", cardHints.cardNumber);
  const qs = params.toString();
  const to = `/human-pregrade/new${qs ? `?${qs}` : ""}`;

  return (
    <div className="rounded-xl border border-sky-500/25 bg-sky-500/10 p-4 mt-4">
      <div className="flex items-start gap-3">
        <UserCheck className="w-5 h-5 text-sky-300 shrink-0 mt-0.5" />
        <div className="space-y-2">
          <p className="text-sm font-medium text-text-primary">{config.productName}</p>
          <p className="text-xs text-text-secondary">
            Get a bespoke report from a human expert — separate from this AI pre-grade.
            From {formatMinorUnits(config.priceMinorUnits, config.currency)}.
          </p>
          <Link to={to} state={{ aiReportSnapshot }} className="inline-block text-xs font-semibold text-sky-300 hover:underline">
            Request expert review →
          </Link>
        </div>
      </div>
    </div>
  );
}

export function HumanPregradeAccountSection() {
  const { enabled, config } = useHumanPregradeConfig();
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof listHumanPregradeOrders>>["orders"]>([]);
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    listHumanPregradeOrders({ pageSize: 5 }).then((r) => setOrders(r.orders));
    listHumanPregradeOrders({ status: "completed", pageSize: 1 }).then((r) =>
      setCompletedCount(r.total)
    );
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-text-secondary">
          {config?.productName ?? "Expert Review"} — human pre-grading reports for your cards.
          {completedCount > 0 ? ` ${completedCount} completed.` : ""}
        </p>
        <Link
          to="/human-pregrade/orders"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-text-primary bg-surface-overlay border border-border-subtle rounded-lg hover:bg-border-subtle transition-colors"
        >
          <UserCheck className="w-4 h-4" />
          View all expert reviews
        </Link>
      </div>
      {orders.length > 0 ? (
        <ul className="divide-y divide-border-subtle rounded-lg border border-border-subtle overflow-hidden">
          {orders.slice(0, 5).map((o) => (
            <li key={o.publicId}>
              <Link to={`/human-pregrade/orders/${o.publicId}`} className="block p-3 hover:bg-surface-overlay space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{o.cardName ?? "Untitled"}</span>
                  {o.status === "completed" ? (
                    <span className="text-xs text-accent">Report ready</span>
                  ) : null}
                </div>
                <HumanPregradeProgress progress={o.progress ?? resolveCustomerProgress(o.status)} compact />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-text-muted">No expert reviews yet.</p>
      )}
    </div>
  );
}
