/** Neutral pricing-card label for staff accounts (replaces amber admin CTAs). */
export function StaffIncludedLabel({ className = "" }: { className?: string }) {
  return (
    <span
      className={`block w-full rounded-xl border border-border-subtle bg-surface-overlay/50 py-2.5 text-sm font-medium text-center text-text-muted ${className}`}
    >
      Included
    </span>
  );
}
