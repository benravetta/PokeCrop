import type { MeasuredCentering } from "./grading.js";
import type { CenteringMeasurementMeta } from "./centeringEngine.js";
import type { CenteringRatios } from "./centeringRatios.js";

export interface SanitizedBorderSide {
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
  leftMm?: number;
  rightMm?: number;
  topMm?: number;
  bottomMm?: number;
}

const clampNorm = (n: number) => Math.max(0, Math.min(1, n));
const clampMm = (n: number) => Math.max(0, Math.min(30, n));

/** Sanitise one side's border width object from client JSON. */
export function sanitizeBorderSide(raw: unknown): SanitizedBorderSide | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const norm = (k: string) => {
    const v = o[k];
    return typeof v === "number" && Number.isFinite(v) ? clampNorm(v) : undefined;
  };
  const mm = (k: string) => {
    const v = o[k];
    return typeof v === "number" && Number.isFinite(v) ? clampMm(v) : undefined;
  };
  const side: SanitizedBorderSide = {
    left: norm("left"),
    right: norm("right"),
    top: norm("top"),
    bottom: norm("bottom"),
    leftMm: mm("leftMm"),
    rightMm: mm("rightMm"),
    topMm: mm("topMm"),
    bottomMm: mm("bottomMm"),
  };
  return Object.values(side).some((v) => v != null) ? side : undefined;
}

export function measuredToRatios(c: MeasuredCentering): CenteringRatios {
  return {
    frontLR: c.front?.leftRight,
    frontTB: c.front?.topBottom,
    backLR: c.back?.leftRight,
    backTB: c.back?.topBottom,
    measured: true,
  };
}

export function measuredToMeta(c: MeasuredCentering): CenteringMeasurementMeta {
  return {
    measured: true,
    front_centering_confidence: c.front_centering_confidence,
    back_centering_confidence: c.back_centering_confidence,
    measurement_confidence: c.measurement_confidence,
    detectionQuality: c.detectionQuality,
    perspectiveWarning: c.perspectiveWarning,
    sleeveSuspected: c.sleeveSuspected,
    lowContrastBorder: c.lowContrastBorder,
    borderlessDesign: c.borderlessDesign,
    userAdjustmentDelta: c.userAdjustmentDelta,
    imageResolution: c.imageResolution,
    printSheetVisible: c.printSheetVisible,
  };
}
