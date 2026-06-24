import type { ReactNode } from "react";

export function AdminStatCard({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string | number | undefined;
  sub?: string;
  tone?: "error" | "accent";
}) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-raised px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-text-muted mb-1">
        {icon}
        <span className="text-[10px] uppercase tracking-wide">{label}</span>
      </div>
      <p
        className={`text-lg font-semibold tabular-nums ${
          tone === "error"
            ? "text-error"
            : tone === "accent"
              ? "text-accent"
              : "text-text-primary"
        }`}
      >
        {value === undefined ? "—" : typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {sub && <p className="text-[11px] text-text-muted mt-0.5">{sub}</p>}
    </div>
  );
}
