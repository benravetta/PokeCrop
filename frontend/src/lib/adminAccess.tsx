import type { MeResponse } from "./api";
import { PLAN_LABELS, type Plan } from "./plans";

export function isAdminMe(me: MeResponse | null | undefined): boolean {
  return me?.isAdmin === true;
}

export function planDisplayLabel(plan: Plan, isAdmin?: boolean): string {
  return isAdmin ? "Admin" : PLAN_LABELS[plan];
}

export function AdminBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-200 ${className}`}
    >
      Admin
    </span>
  );
}

export function AdminAccessNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`rounded-xl border border-amber-500/30 bg-amber-500/10 ${
        compact ? "px-3 py-2.5 text-[12px]" : "px-4 py-3 text-[13px]"
      } text-amber-100/90 leading-relaxed`}
    >
      <span className="font-semibold text-amber-200">Admin account</span>
      {" — "}
      Full access to crops, grades, and API keys. Billing and plan changes are not available for
      admin accounts.
    </div>
  );
}
