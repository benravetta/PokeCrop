import type { ReactNode } from "react";

/** Shared disclaimer / legal copy styling for app and marketing footers. */
export function FooterLegalBlock({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`max-w-2xl text-xs leading-relaxed text-text-muted ${className}`.trim()}
    >
      {children}
    </p>
  );
}
