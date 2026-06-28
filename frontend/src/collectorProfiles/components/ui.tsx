import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";

export function CollectorSection({
  icon,
  title,
  description,
  children,
  className = "",
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-border-subtle bg-surface-raised p-5 sm:p-6 ${className}`}
    >
      <div className="mb-4 flex items-start gap-3">
        {icon && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
            {icon}
          </span>
        )}
        <div>
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-text-muted">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export function CollectorPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-text-secondary">{description}</p>}
      </div>
      {actions && <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto">{actions}</div>}
    </div>
  );
}

export function CollectorField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-text-secondary">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-text-muted">{hint}</span>}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-border-subtle bg-surface px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20";

export function CollectorInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={inputClass} {...props} />;
}

export function CollectorTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`${inputClass} min-h-[100px] resize-y`}
      {...props}
    />
  );
}

export function CollectorSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={inputClass} {...props} />;
}

export function CollectorButton({
  variant = "primary",
  className = "",
  loading,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50";
  const styles =
    variant === "primary"
      ? "bg-accent text-white shadow-[0_4px_20px_-6px_var(--color-accent)] hover:bg-accent-hover"
      : variant === "secondary"
        ? "border border-border-strong bg-surface-raised text-text-primary hover:bg-surface-overlay"
        : "text-text-secondary hover:bg-surface-overlay hover:text-text-primary";
  return (
    <button className={`${base} ${styles} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function CollectorLinkButton({
  to,
  variant = "primary",
  className = "",
  children,
}: {
  to: string;
  variant?: "primary" | "secondary";
  className?: string;
  children: ReactNode;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition";
  const styles =
    variant === "primary"
      ? "bg-accent text-white shadow-[0_4px_20px_-6px_var(--color-accent)] hover:bg-accent-hover"
      : "border border-border-strong bg-surface-raised text-text-primary hover:bg-surface-overlay";
  return (
    <Link to={to} className={`${base} ${styles} ${className}`}>
      {children}
    </Link>
  );
}

export function CollectorStatusBadge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "success" | "warning" | "accent";
  children: ReactNode;
}) {
  const tones = {
    neutral: "border-border-subtle bg-surface-overlay text-text-secondary",
    success: "border-success/30 bg-success/10 text-success",
    warning: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    accent: "border-accent/30 bg-accent/10 text-accent",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function CollectorEmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border-subtle bg-surface/40 px-6 py-12 text-center">
      <h3 className="text-base font-semibold text-text-primary">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-text-secondary">{body}</p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

export function CollectorLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-text-secondary">
      <Loader2 className="h-7 w-7 animate-spin text-accent" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export type CollectorCardPreview = {
  publicId: string;
  cardName: string;
  setName?: string | null;
  thumbnailUrl?: string | null;
  status?: string;
};

export function CollectorCardGrid({
  cards,
  linkTo,
  empty,
}: {
  cards: CollectorCardPreview[];
  linkTo: (card: CollectorCardPreview) => string;
  empty?: ReactNode;
}) {
  if (!cards.length) return empty ?? null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
      {cards.map((card) => (
        <CollectorCardTile key={card.publicId} card={card} to={linkTo(card)} />
      ))}
    </div>
  );
}

export function CollectorCardTile({
  card,
  to,
  meta,
}: {
  card: CollectorCardPreview;
  to: string;
  meta?: ReactNode;
}) {
  return (
    <Link
      to={to}
      className="group overflow-hidden rounded-2xl border border-border-subtle bg-surface-raised transition hover:border-accent/40 hover:shadow-[0_8px_30px_-12px_rgba(124,108,246,0.35)]"
    >
      <div className="relative aspect-[3/4] bg-surface-overlay">
        {card.thumbnailUrl ? (
          <img
            src={card.thumbnailUrl}
            alt=""
            className="h-full w-full object-contain p-2 transition group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-text-muted">No image</div>
        )}
      </div>
      <div className="border-t border-border-subtle p-3">
        <p className="truncate text-sm font-medium text-text-primary">{card.cardName}</p>
        {card.setName && <p className="mt-0.5 truncate text-xs text-text-secondary">{card.setName}</p>}
        {meta}
        {!meta && card.status && (
          <p className="mt-2 text-[10px] uppercase tracking-wide text-text-muted">{card.status.replace(/_/g, " ")}</p>
        )}
      </div>
    </Link>
  );
}

export function CollectorListRow({
  to,
  title,
  subtitle,
  badge,
}: {
  to?: string;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
}) {
  const className =
    "flex items-center justify-between gap-4 rounded-2xl border border-border-subtle bg-surface-raised px-4 py-4 transition hover:border-accent/40 hover:bg-surface-overlay/30";
  const inner = (
    <>
      <div className="min-w-0">
        <p className="truncate font-medium text-text-primary">{title}</p>
        {subtitle && <p className="mt-0.5 truncate text-sm text-text-secondary">{subtitle}</p>}
      </div>
      {badge}
    </>
  );
  if (to) {
    return (
      <Link to={to} className={className}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}
