import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  aside,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  aside?: ReactNode;
}) {
  const formCard = (
    <div className="rounded-2xl border border-border-subtle bg-surface-raised p-6 shadow-2xl">
      <div className="mb-5 text-center">
        <h1 className="text-lg font-semibold text-text-primary">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-[13px] text-text-secondary leading-relaxed">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-surface flex flex-col">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className={`w-full anim-rise ${aside ? "max-w-4xl" : "max-w-sm"}`}>
          <Link to="/" className="flex items-center justify-center mb-7">
            <img
              src="/gemcheck-logo.png"
              alt="GemCheck — by Looky"
              className="h-12 w-auto select-none"
              draggable={false}
            />
          </Link>

          {aside ? (
            <div className="grid gap-5 lg:grid-cols-2 lg:gap-6 lg:items-stretch">
              {formCard}
              {aside}
            </div>
          ) : (
            formCard
          )}

          {footer && (
            <div className="mt-5 text-center text-[13px] text-text-secondary">{footer}</div>
          )}
        </div>
      </div>
    </div>
  );
}

export function Field({
  label,
  type = "text",
  value,
  onChange,
  autoComplete,
  placeholder,
  required,
  autoFocus,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-[12px] font-medium text-text-secondary mb-1.5">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        className="w-full rounded-lg bg-surface-overlay border border-border-subtle px-3 py-2.5 text-sm text-text-primary
                   placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
      />
    </label>
  );
}

export function SubmitButton({
  loading,
  children,
}: {
  loading?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-white
                 bg-accent rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? "Please wait…" : children}
    </button>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="mb-4 rounded-lg bg-error/10 border border-error/20 px-3 py-2 text-[13px] text-error">
      {message}
    </div>
  );
}
