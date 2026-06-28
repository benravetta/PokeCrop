import type { ReactNode } from "react";

/** Fixed bottom action bar with safe-area padding for primary CTAs on mobile. */
export function StickyFooterBar({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`sticky bottom-0 z-20 border-t border-border-subtle bg-surface-raised/95 backdrop-blur-sm safe-bottom ${className}`.trim()}
    >
      <div className="page-x mx-auto flex w-full max-w-6xl flex-wrap items-center gap-2 py-3 sm:py-3.5">
        {children}
      </div>
    </div>
  );
}
