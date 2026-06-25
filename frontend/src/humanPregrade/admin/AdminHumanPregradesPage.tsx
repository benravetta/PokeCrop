import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listAdminHumanPregrades } from "../api";
import { useHumanPregradeConfig } from "../hooks/useHumanPregradeConfig";
import { customerStatusLabel } from "../copy";

export function AdminHumanPregradesPage() {
  const { enabled } = useHumanPregradeConfig();
  const [orders, setOrders] = useState<Record<string, unknown>[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!enabled) return;
    listAdminHumanPregrades(status || undefined).then((r) => setOrders(r.orders ?? []));
  }, [enabled, status]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-lg font-semibold">Human pre-grades</h1>
        <Link to="/admin/human-pregrades/settings" className="text-sm text-accent">Settings</Link>
      </div>
      <select className="rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">All statuses</option>
        <option value="queued">Queued</option>
        <option value="assigned">Assigned</option>
        <option value="under_review">Under review</option>
        <option value="quality_check">Quality check</option>
        <option value="completed">Completed</option>
      </select>
      <div className="overflow-x-auto rounded-xl border border-border-subtle">
        <table className="w-full text-sm">
          <thead className="bg-surface-overlay text-left">
            <tr>
              <th className="p-3">Card</th>
              <th className="p-3">Status</th>
              <th className="p-3">Submitted</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={String(o.id)} className="border-t border-border-subtle">
                <td className="p-3">{String(o.card_name ?? "—")}</td>
                <td className="p-3">{customerStatusLabel(String(o.status))}</td>
                <td className="p-3">{o.submitted_at ? new Date(String(o.submitted_at)).toLocaleDateString() : "—"}</td>
                <td className="p-3">
                  <Link to={`/admin/human-pregrades/${o.id}/review`} className="text-accent">Review</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
