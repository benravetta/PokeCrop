import type { HTMLAttributes, ReactNode } from "react";

/**
 * Standard page width + gutters (`pageLayout/PageContainer`). Use inside scrollable main/outlet areas.
 *
 * - `default` / `wide`: max-w-6xl + page-x + page-y
 * - `narrow`: max-w-2xl (account, auth-adjacent forms)
 * - `medium`: max-w-5xl (history, admin lists)
 * - `fullBleed`: gutters only, no max-width cap
 *
 * App shell uses h-[100dvh] overflow-hidden; pages scroll internally via
 * flex-1 min-h-0 overflow-y-auto wrappers — keep one scroll container per route.
 */
export type PageContainerWidth = "default" | "narrow" | "medium" | "wide" | "marketing" | "fullBleed";

const widthClass: Record<PageContainerWidth, string> = {
  default: "mx-auto w-full max-w-6xl page-x page-y",
  wide: "mx-auto w-full max-w-6xl page-x page-y",
  narrow: "mx-auto w-full max-w-2xl page-x page-y",
  medium: "mx-auto w-full max-w-5xl page-x page-y",
  marketing: "mx-auto w-full max-w-3xl page-x page-y",
  fullBleed: "w-full page-x page-y",
};

export function PageContainer({
  width = "default",
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  width?: PageContainerWidth;
  children: ReactNode;
}) {
  return (
    <div className={`${widthClass[width]} ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}
