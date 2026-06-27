import { Link } from "react-router-dom";
import {
  cropUsageDetail,
  cropUsageFromMe,
  cropUsageHeadline,
  gradeUsageDetail,
  gradeUsageFromQuota,
  gradeUsageHeadline,
  type GradeUsageSnapshot,
} from "../../lib/planUsageDisplay";
import type { GradeQuota, MeResponse } from "../../lib/api";

type CardShellProps = {
  eyebrow: string;
  headline: string;
  detail: string;
  depleted?: boolean;
  compact?: boolean;
  className?: string;
};

function PlanUsageCardShell({
  eyebrow,
  headline,
  detail,
  depleted,
  compact,
  className = "",
}: CardShellProps) {
  return (
    <div
      className={`rounded-xl border backdrop-blur-sm ${
        depleted
          ? "border-error/30 bg-error/5"
          : "border-border-subtle bg-surface/60"
      } ${compact ? "px-3 py-2.5" : "px-4 py-3"} ${className}`}
    >
      <div className="text-[11px] uppercase tracking-wide text-text-muted">{eyebrow}</div>
      <div
        className={`${compact ? "text-base" : "text-lg"} font-semibold text-text-primary tabular-nums ${
          compact ? "mt-0.5" : "mt-1"
        }`}
      >
        {headline}
      </div>
      <div className={`text-[11px] text-text-muted ${compact ? "mt-0.5" : "mt-1"}`}>{detail}</div>
    </div>
  );
}

export function CropUsageCard({
  me,
  compact,
  className,
}: {
  me: MeResponse | null;
  compact?: boolean;
  className?: string;
}) {
  const usage = cropUsageFromMe(me);
  if (!usage) return null;

  if (usage.unlimited) {
    return (
      <PlanUsageCardShell
        eyebrow="Crop allowance"
        headline={cropUsageHeadline(usage)}
        detail={cropUsageDetail(usage)}
        compact={compact}
        className={className}
      />
    );
  }

  return (
    <PlanUsageCardShell
      eyebrow="Daily crop allowance"
      headline={cropUsageHeadline(usage)}
      detail={cropUsageDetail(usage)}
      depleted={usage.remaining <= 0}
      compact={compact}
      className={className}
    />
  );
}

function gradeCardFromUsage(usage: GradeUsageSnapshot, compact?: boolean, className?: string) {
  return (
    <PlanUsageCardShell
      eyebrow={usage.window === "month" ? "Monthly pre-grades" : "Daily pre-grades"}
      headline={gradeUsageHeadline(usage)}
      detail={gradeUsageDetail(usage)}
      depleted={usage.remaining <= 0}
      compact={compact}
      className={className}
    />
  );
}

export function GradeUsageCard({
  quota,
  compact,
  className,
}: {
  quota: GradeQuota | null;
  compact?: boolean;
  className?: string;
}) {
  if (!quota || quota.isAdmin) return null;
  return gradeCardFromUsage(gradeUsageFromQuota(quota), compact, className);
}

export function GradeUsageInline({ quota }: { quota: GradeQuota | null }) {
  return <GradeUsageCard quota={quota} compact className="shrink-0 text-right" />;
}

export function PlanUsageStrip({ me }: { me: MeResponse | null }) {
  const crop = cropUsageFromMe(me);
  if (!crop || crop.unlimited) return null;

  return (
    <div className="mx-4 sm:mx-5 mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-subtle bg-surface-raised px-3 py-2.5 text-xs">
      <div className="text-text-secondary">
        <span className="font-medium text-text-primary">{cropUsageHeadline(crop)}</span>
        <span className="text-text-muted"> · {cropUsageDetail(crop)}</span>
      </div>
      {crop.remaining <= 0 ? (
        <Link to="/pricing" className="font-medium text-accent hover:text-accent-hover">
          Upgrade for unlimited
        </Link>
      ) : null}
    </div>
  );
}
