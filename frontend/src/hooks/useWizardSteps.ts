import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface WizardStep {
  id: string;
  /** Short label shown in the progress header. */
  label: string;
  /** When false, `next()` is a no-op and the primary CTA should be disabled. */
  canAdvance?: boolean;
  /** When true, the step is skipped entirely (not counted or navigable). */
  hidden?: boolean;
}

// ---- Pure helpers (unit-tested) ----

/** Steps that are currently navigable. */
export function getVisibleSteps<T extends WizardStep>(steps: T[]): T[] {
  return steps.filter((s) => !s.hidden);
}

/**
 * Resolve the starting index within the visible steps. Falls back to the first
 * visible step when the requested id is missing or hidden.
 */
export function getStartIndex(steps: WizardStep[], initialStepId?: string): number {
  const visible = getVisibleSteps(steps);
  if (!initialStepId) return 0;
  const idx = visible.findIndex((s) => s.id === initialStepId);
  return idx >= 0 ? idx : 0;
}

/**
 * Index after attempting to advance. Stays put when the current step gates
 * (`canAdvance === false`) or when already on the last visible step.
 */
export function getNextIndex(steps: WizardStep[], index: number): number {
  const visible = getVisibleSteps(steps);
  const current = visible[index];
  if (!current) return index;
  if (current.canAdvance === false) return index;
  return Math.min(index + 1, visible.length - 1);
}

/** Index after stepping back. Never goes below zero. */
export function getPrevIndex(index: number): number {
  return Math.max(0, index - 1);
}

/** Clamp an id to a valid visible index (used when the step list changes). */
export function indexOfId(steps: WizardStep[], id: string | null): number {
  if (!id) return -1;
  return getVisibleSteps(steps).findIndex((s) => s.id === id);
}

// ---- Hook ----

export interface WizardController {
  /** Currently navigable steps. */
  steps: WizardStep[];
  /** Active index within the visible steps. */
  index: number;
  /** Active step. */
  step: WizardStep;
  total: number;
  isFirst: boolean;
  isLast: boolean;
  canAdvance: boolean;
  next: () => void;
  back: () => void;
  goTo: (id: string) => void;
}

export interface UseWizardStepsOptions {
  steps: WizardStep[];
  initialStepId?: string;
  /**
   * Push a history entry on each forward advance so the device back gesture
   * returns to the previous step instead of leaving the page.
   */
  syncHistory?: boolean;
}

export function useWizardSteps({
  steps,
  initialStepId,
  syncHistory = true,
}: UseWizardStepsOptions): WizardController {
  const visible = useMemo(() => getVisibleSteps(steps), [steps]);

  // Track the active step by id so it survives changes to the step list
  // (e.g. the back-centring step appearing once a back photo is added).
  const [activeId, setActiveId] = useState<string>(() => {
    const start = getStartIndex(steps, initialStepId);
    return getVisibleSteps(steps)[start]?.id ?? "";
  });

  const depth = useRef(0);
  const historyEnabled = syncHistory && typeof window !== "undefined";

  let index = visible.findIndex((s) => s.id === activeId);
  if (index < 0) index = 0;
  const step = visible[index] ?? { id: "", label: "", canAdvance: true };

  const pushHistory = useCallback(() => {
    if (!historyEnabled) return;
    depth.current += 1;
    window.history.pushState({ wizardDepth: depth.current }, "");
  }, [historyEnabled]);

  const goToIndex = useCallback(
    (nextIdx: number, viaHistory = false) => {
      const target = getVisibleSteps(steps)[nextIdx];
      if (!target) return;
      setActiveId(target.id);
      if (!viaHistory && historyEnabled && nextIdx > 0) pushHistory();
    },
    [steps, historyEnabled, pushHistory]
  );

  const next = useCallback(() => {
    const nextIdx = getNextIndex(steps, index);
    if (nextIdx !== index) goToIndex(nextIdx);
  }, [steps, index, goToIndex]);

  const back = useCallback(() => {
    if (historyEnabled && depth.current > 0) {
      window.history.back();
      return;
    }
    const prevIdx = getPrevIndex(index);
    if (prevIdx !== index) goToIndex(prevIdx);
  }, [historyEnabled, index, goToIndex]);

  const goTo = useCallback(
    (id: string) => {
      const idx = indexOfId(steps, id);
      if (idx >= 0 && idx !== index) goToIndex(idx);
    },
    [steps, index, goToIndex]
  );

  // Bring the device back gesture back into the wizard.
  useEffect(() => {
    if (!historyEnabled) return;
    const onPop = () => {
      depth.current = Math.max(0, depth.current - 1);
      setActiveId((prev) => {
        const idx = getVisibleSteps(steps).findIndex((s) => s.id === prev);
        const prevIdx = getPrevIndex(idx < 0 ? 0 : idx);
        return getVisibleSteps(steps)[prevIdx]?.id ?? prev;
      });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [historyEnabled, steps]);

  return {
    steps: visible,
    index,
    step,
    total: visible.length,
    isFirst: index === 0,
    isLast: index === visible.length - 1,
    canAdvance: step.canAdvance !== false,
    next,
    back,
    goTo,
  };
}
