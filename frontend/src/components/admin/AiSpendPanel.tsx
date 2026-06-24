import { DollarSign } from "lucide-react";
import type { AiSpend } from "../../lib/api";

export function AiSpendPanel({
  spend,
  days = 30,
  compact,
}: {
  spend: AiSpend | null;
  days?: number;
  compact?: boolean;
}) {
  if (!spend) return null;

  const maxDay = Math.max(...spend.by_day.map((d) => d.cost_usd), 0.01);

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-raised p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="flex items-center gap-2 text-sm text-text-secondary">
          <DollarSign className="w-4 h-4 text-accent" />
          AI spend ({days} days)
        </span>
        <span className="text-lg font-semibold text-text-primary tabular-nums">
          ${spend.total_cost_usd.toFixed(2)}
        </span>
      </div>

      {!compact && spend.by_day.length > 0 && (
        <div className="flex items-end gap-0.5 h-16 mb-3">
          {spend.by_day.map((d) => (
            <div
              key={d.day}
              className="flex-1 min-w-0 bg-accent/70 rounded-t-sm"
              style={{ height: `${Math.max(4, (d.cost_usd / maxDay) * 100)}%` }}
              title={`${d.day}: $${d.cost_usd.toFixed(2)}`}
            />
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-text-muted">
        <span>{spend.total_calls.toLocaleString()} calls</span>
        {spend.by_feature.map((f) => (
          <span key={f.feature}>
            {f.feature}:{" "}
            <span className="text-text-secondary">${f.cost_usd.toFixed(2)}</span> ({f.calls})
          </span>
        ))}
      </div>
    </div>
  );
}
