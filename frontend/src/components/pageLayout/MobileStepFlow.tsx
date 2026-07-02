import { useEffect, useRef, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { StickyFooterBar } from "./StickyFooterBar";
import type { WizardController } from "../../hooks/useWizardSteps";

/**
 * Full-height, one-step-at-a-time scaffold for mobile guided flows.
 *
 * Renders a compact progress header, a scrollable content region where each
 * step owns the viewport, and a sticky footer with a single dominant primary
 * CTA plus a de-emphasised Back action. Focus moves to the step heading on
 * change for accessibility.
 */
export function MobileStepFlow({
  wizard,
  title,
  subtitle,
  banner,
  children,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  primaryIcon,
  secondary,
  showBack = true,
}: {
  wizard: WizardController;
  title: string;
  subtitle?: string;
  banner?: ReactNode;
  children: ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryIcon?: ReactNode;
  secondary?: ReactNode;
  showBack?: boolean;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const pct = wizard.total > 1 ? ((wizard.index + 1) / wizard.total) * 100 : 100;

  useEffect(() => {
    headingRef.current?.focus();
  }, [wizard.step.id]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Progress header */}
      <div className="page-x pt-3 pb-2 border-b border-border-subtle">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
            Step {wizard.index + 1} of {wizard.total}
          </span>
          <span className="text-[11px] text-text-muted" aria-current="step">
            {wizard.step.label}
          </span>
        </div>
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-overlay">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Scrollable step body */}
      <div className="flex-1 min-h-0 overflow-y-auto page-x pt-4 pb-6">
        {banner}
        <div key={wizard.step.id} className="anim-rise">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-xl font-semibold tracking-tight text-text-primary outline-none"
          >
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm leading-relaxed text-text-secondary">{subtitle}</p>
          )}
          <div className="mt-4">{children}</div>
        </div>
      </div>

      {/* Footer actions */}
      <StickyFooterBar>
        <div className="flex w-full items-center gap-2">
          {showBack && !wizard.isFirst ? (
            <button
              onClick={wizard.back}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border-strong px-3 py-2.5 text-sm text-text-secondary hover:bg-surface-overlay transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          ) : null}
          {secondary}
          <button
            onClick={onPrimary}
            disabled={primaryDisabled}
            className="ml-auto inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_24px_-6px_var(--color-accent)] hover:bg-accent-hover disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed transition-all sm:flex-none sm:min-w-[10rem]"
          >
            {primaryIcon}
            {primaryLabel}
          </button>
        </div>
      </StickyFooterBar>
    </div>
  );
}
