/** Shared styles for site headers — desktop actions, app nav, and mobile sheet CTAs. */

export const headerGhostBtn =
  "inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-overlay/60 transition-colors";

export const headerPrimaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20";

export const headerOutlineBtn =
  "inline-flex items-center justify-center rounded-xl border border-border-strong px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-overlay/60 transition-colors";

export const headerIconBtn =
  "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-text-secondary hover:text-text-primary hover:bg-surface-overlay transition-colors";

export const appNavLink =
  "px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors";

export const appNavActive = "bg-surface-overlay text-text-primary";

export const appNavIdle =
  "text-text-secondary hover:text-text-primary hover:bg-surface-overlay/60";

export const mobileOutlineBtn =
  "rounded-xl border border-border-strong px-4 py-2.5 text-sm font-medium text-center text-text-primary";

export const mobilePrimaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover transition-colors w-full";

export const mobileMenuSection =
  "mt-4 pt-4 border-t border-border-subtle md:hidden";

export const mobileSheetLink =
  "flex items-center min-h-11 px-3 py-3 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-overlay transition-colors";

export const mobileSheetLinkActive =
  "flex items-center min-h-11 px-3 py-3 rounded-lg text-sm text-text-primary font-medium bg-surface-overlay/80";

export const mobileActionGrid = "grid grid-cols-2 gap-2";
