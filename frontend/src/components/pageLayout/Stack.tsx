import type { HTMLAttributes, ReactNode } from "react";

export function Stack({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={`space-y-4 sm:space-y-6 ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}
