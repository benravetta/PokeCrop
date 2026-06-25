import {
  getGradingCenteringConfig,
  thresholdsForGrader,
  type CenteringThresholdRow,
  type GraderKey,
} from "./gradingCriteria/index.js";
import { largerPct, type CenteringRatios } from "./centeringRatios.js";

export type GradeCapType = "hard" | "soft" | "none";

export interface CenteringMeasurementMeta {
  measured?: boolean;
  front_centering_confidence?: number;
  back_centering_confidence?: number;
  measurement_confidence?: number;
  detectionQuality?: "good" | "fair" | "poor";
  perspectiveWarning?: boolean;
  sleeveSuspected?: boolean;
  lowContrastBorder?: boolean;
  borderlessDesign?: boolean;
  userAdjustmentDelta?: number;
  imageResolution?: number;
  printSheetVisible?: boolean;
}

export interface GraderCenteringResult {
  grader: GraderKey;
  centering_equivalent: number | null;
  centering_subgrade?: number | null;
  cgc_assessment?: string | null;
  tag_score_band?: string | null;
  threshold_source: string;
  threshold_type: string;
  grade_cap: GradeCapType;
  grade_cap_value: number | null;
  grade_cap_confidence: number | null;
}

export interface CenteringAnalysis {
  front_horizontal: string | null;
  front_vertical: string | null;
  back_horizontal: string | null;
  back_vertical: string | null;
  worst_front_axis: "horizontal" | "vertical" | null;
  worst_back_axis: "horizontal" | "vertical" | null;
  raw_centering_quality: number;
  front_centering_confidence: number;
  back_centering_confidence: number;
  measurement_confidence: number;
  is_miscut: boolean;
  miscut_confidence: number;
  miscut_reason: string | null;
  grade_cap: GradeCapType;
  grade_cap_value: number | null;
  grade_cap_confidence: number | null;
  explanation: string;
  grader_results: Partial<Record<GraderKey, GraderCenteringResult>>;
}

type AxisKey = "frontH" | "frontV" | "backH" | "backV";

function parseAxes(ratios: CenteringRatios): Record<AxisKey, number | null> {
  return {
    frontH: ratios.frontLR ? largerPct(ratios.frontLR) : null,
    frontV: ratios.frontTB ? largerPct(ratios.frontTB) : null,
    backH: ratios.backLR ? largerPct(ratios.backLR) : null,
    backV: ratios.backTB ? largerPct(ratios.backTB) : null,
  };
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function toleranceForConfidence(confidence: number): number {
  const cfg = getGradingCenteringConfig();
  if (confidence >= 0.75) return cfg.high_confidence_tolerance_percent;
  if (confidence >= 0.55) return cfg.medium_confidence_tolerance_percent;
  return cfg.medium_confidence_tolerance_percent + 1;
}

function resolveConfidence(
  meta: CenteringMeasurementMeta | undefined,
  hasRatios: boolean
): { front: number; back: number; combined: number } {
  if (meta?.measurement_confidence != null && Number.isFinite(meta.measurement_confidence)) {
    const c = clamp01(meta.measurement_confidence);
    return {
      front: clamp01(meta.front_centering_confidence ?? c),
      back: clamp01(meta.back_centering_confidence ?? c),
      combined: c,
    };
  }
  let front = meta?.front_centering_confidence ?? 0.85;
  let back = meta?.back_centering_confidence ?? 0.85;
  if (meta?.borderlessDesign) front = Math.min(front, 0.5);
  if (meta?.lowContrastBorder) front = Math.min(front, 0.65);
  if (meta?.sleeveSuspected) {
    front = Math.min(front, 0.45);
    back = Math.min(back, 0.45);
  }
  if (meta?.perspectiveWarning) {
    front = Math.min(front, 0.5);
    back = Math.min(back, 0.5);
  }
  if (meta?.detectionQuality === "poor") {
    front = Math.min(front, 0.55);
    back = Math.min(back, 0.55);
  } else if (meta?.detectionQuality === "fair") {
    front = Math.min(front, 0.72);
    back = Math.min(back, 0.72);
  }
  if (!meta?.measured && !hasRatios) {
    front = 0.4;
    back = 0.4;
  }
  front = clamp01(front);
  back = clamp01(back);
  const combined = clamp01(meta?.measured ? front * 0.7 + back * 0.3 : Math.min(front, back));
  return { front, back, combined };
}

function axisStatus(
  pct: number | null,
  maxAllowed: number,
  tolerance: number
): "pass" | "borderline" | "fail" | "missing" {
  if (pct == null) return "missing";
  if (pct <= maxAllowed) return "pass";
  if (pct <= maxAllowed + tolerance) return "borderline";
  return "fail";
}

function bgsDualAxisPasses(
  frontH: number | null,
  frontV: number | null,
  tolerance: number
): boolean {
  const axes = [frontH, frontV].filter((n): n is number => n != null);
  if (axes.length < 2) return false;
  const [a, b] = axes;
  return (
    (a <= 50 + tolerance && b <= 55 + tolerance) ||
    (b <= 50 + tolerance && a <= 55 + tolerance)
  );
}

function rowPasses(
  row: CenteringThresholdRow,
  axes: Record<AxisKey, number | null>,
  tolerance: number
): { pass: boolean; worstBorderline: boolean; worstFail: boolean } {
  if (row.bgs_dual_axis_rule) {
    const dualStrict =
      bgsDualAxisPasses(axes.frontH, axes.frontV, 0) ||
      bgsDualAxisPasses(axes.frontH, axes.frontV, tolerance);
    const dualOk = bgsDualAxisPasses(axes.frontH, axes.frontV, 0);
    const dualBorderline = !dualOk && dualStrict;
    const backStatuses = [
      axisStatus(axes.backH, row.back_horizontal_max, 0),
      axisStatus(axes.backV, row.back_vertical_max, 0),
    ].filter((s) => s !== "missing");
    const backBorderlineStatuses = [
      axisStatus(axes.backH, row.back_horizontal_max, tolerance),
      axisStatus(axes.backV, row.back_vertical_max, tolerance),
    ].filter((s) => s !== "missing");
    const backOk = backStatuses.every((s) => s === "pass");
    const backBorderline = backStatuses.some((s) => s === "fail") &&
      backBorderlineStatuses.every((s) => s !== "fail");
    const backFail = backBorderlineStatuses.some((s) => s === "fail");
    return {
      pass: dualOk && backOk,
      worstBorderline: dualBorderline || backBorderline,
      worstFail: backFail || (!dualOk && !dualStrict),
    };
  }

  const checks: Array<{ pct: number | null; max: number }> = [
    { pct: axes.frontH, max: row.front_horizontal_max },
    { pct: axes.frontV, max: row.front_vertical_max },
    { pct: axes.backH, max: row.back_horizontal_max },
    { pct: axes.backV, max: row.back_vertical_max },
  ];

  let anyPresent = false;
  let anyFail = false;
  let anyBorderline = false;

  for (const { pct, max } of checks) {
    if (pct == null) continue;
    anyPresent = true;
    const strict = axisStatus(pct, max, 0);
    const withTol = axisStatus(pct, max, tolerance);
    if (strict === "fail" && withTol === "fail") anyFail = true;
    if (strict === "fail" && withTol !== "fail") anyBorderline = true;
    if (strict === "fail" && withTol === "fail") break;
  }

  if (!anyPresent) return { pass: false, worstBorderline: false, worstFail: false };

  return {
    pass: !anyFail && !anyBorderline,
    worstBorderline: anyBorderline,
    worstFail: anyFail,
  };
}

function sideBandGrade(
  side: "front" | "back",
  axes: Record<AxisKey, number | null>,
  rows: CenteringThresholdRow[]
): number | null {
  for (const row of rows) {
    if (side === "front") {
      if (row.bgs_dual_axis_rule) {
        if (bgsDualAxisPasses(axes.frontH, axes.frontV, 0)) return row.grade;
        continue;
      }
      if (axes.frontH == null && axes.frontV == null) return null;
      const ok =
        (axes.frontH == null || axisStatus(axes.frontH, row.front_horizontal_max, 0) === "pass") &&
        (axes.frontV == null || axisStatus(axes.frontV, row.front_vertical_max, 0) === "pass");
      if (ok) return row.grade;
    } else {
      if (axes.backH == null && axes.backV == null) return null;
      const ok =
        (axes.backH == null || axisStatus(axes.backH, row.back_horizontal_max, 0) === "pass") &&
        (axes.backV == null || axisStatus(axes.backV, row.back_vertical_max, 0) === "pass");
      if (ok) return row.grade;
    }
  }
  return null;
}

function weightedCenteringEquivalent(
  frontGrade: number | null,
  backGrade: number | null,
  floor: number
): number {
  const cfg = getGradingCenteringConfig();
  if (frontGrade != null && backGrade != null) {
    return (
      frontGrade * cfg.front_centering_weight + backGrade * cfg.back_centering_weight
    );
  }
  if (frontGrade != null) return frontGrade;
  if (backGrade != null) return backGrade;
  return floor;
}

function evaluateGrader(
  grader: GraderKey,
  axes: Record<AxisKey, number | null>,
  confidence: number,
  meta?: CenteringMeasurementMeta
): GraderCenteringResult {
  const cfg = getGradingCenteringConfig();
  const tolerance = toleranceForConfidence(confidence);
  const rows = thresholdsForGrader(grader);

  let matched: CenteringThresholdRow | null = null;
  let matchedBorderline = false;

  for (const row of rows) {
    const { pass, worstBorderline } = rowPasses(row, axes, tolerance);
    if (pass) {
      matched = row;
      matchedBorderline = worstBorderline;
      break;
    }
  }

  const floor =
    grader === "BGS" ? 2 : grader === "TAG" ? 1.5 : grader === "ACE" ? 1 : 2;

  // Cap grade from strict all-axis row match; equivalent uses 70/30 front/back weighting.
  const capGrade = matched?.grade ?? floor;
  const frontBand = sideBandGrade("front", axes, rows);
  const backBand = sideBandGrade("back", axes, rows);
  const weighted = weightedCenteringEquivalent(frontBand, backBand, capGrade);
  const equivalent = Math.min(weighted, capGrade);
  const displayEquivalent =
    grader === "BGS" || grader === "CGC"
      ? Math.round(equivalent * 2) / 2
      : grader === "TAG" || grader === "ACE"
        ? Math.round(equivalent * 10) / 10
        : Math.round(equivalent);

  let gradeCap: GradeCapType = "none";
  let capValue: number | null = null;
  let capConfidence: number | null = null;

  if (confidence >= cfg.minimum_confidence_for_cap && matched) {
    capValue = capGrade;
    capConfidence = confidence;
    if (matchedBorderline || matched.is_approximate) {
      if (confidence >= cfg.minimum_confidence_for_soft_cap) gradeCap = "soft";
    } else if (confidence >= cfg.minimum_confidence_for_hard_cap) {
      gradeCap = "hard";
    } else if (confidence >= cfg.minimum_confidence_for_soft_cap) {
      gradeCap = "soft";
    }
  }

  if (matched?.threshold_type === "inferred" && gradeCap === "hard") {
    gradeCap = "soft";
  }

  if (confidence < cfg.minimum_confidence_for_cap) {
    gradeCap = "none";
    capValue = null;
    capConfidence = null;
  }

  if (meta?.borderlessDesign && grader !== "ACE") {
    if (gradeCap === "hard") gradeCap = "soft";
  }

  const cgcAssessment =
    grader === "CGC"
      ? matched?.label
        ? `${matched.label} range`
        : matched
          ? `Grade ${matched.grade} range`
          : null
      : null;

  const tagBand =
    grader === "TAG" && matched?.tag_score_min != null && matched.tag_score_max != null
      ? `${matched.tag_score_min}–${matched.tag_score_max}`
      : null;

  return {
    grader,
    centering_equivalent: displayEquivalent,
    centering_subgrade: displayEquivalent,
    cgc_assessment: cgcAssessment,
    tag_score_band: tagBand,
    threshold_source: matched?.source_type ?? "engine_interpolation",
    threshold_type: matched?.threshold_type ?? "inferred",
    grade_cap: gradeCap,
    grade_cap_value: capValue,
    grade_cap_confidence: capConfidence,
  };
}

function rawCenteringQuality(axes: Record<AxisKey, number | null>): number {
  const pcts = Object.values(axes).filter((n): n is number => n != null);
  if (!pcts.length) return 50;
  const worst = Math.max(...pcts);
  const deviation = Math.max(0, worst - 50);
  const score = 100 - deviation * 2.5;
  return Math.round(Math.max(0, Math.min(100, score)));
}

function worstAxis(
  h: number | null,
  v: number | null
): "horizontal" | "vertical" | null {
  if (h == null && v == null) return null;
  if (h == null) return "vertical";
  if (v == null) return "horizontal";
  return h >= v ? "horizontal" : "vertical";
}

function detectMiscut(
  axes: Record<AxisKey, number | null>,
  meta?: CenteringMeasurementMeta
): { is_miscut: boolean; confidence: number; reason: string | null } {
  if (meta?.printSheetVisible) {
    return { is_miscut: true, confidence: 0.75, reason: "Print sheet or adjacent card visible." };
  }
  const pcts = Object.values(axes).filter((n): n is number => n != null);
  const extreme = pcts.some((p) => p >= 92);
  if (meta?.borderlessDesign && extreme) {
    return {
      is_miscut: true,
      confidence: 0.55,
      reason: "Borderless design with extreme asymmetry — possible miscut.",
    };
  }
  if (pcts.length && Math.max(...pcts) >= 95) {
    return {
      is_miscut: true,
      confidence: 0.7,
      reason: "Extreme off-centring consistent with miscut or off-cut.",
    };
  }
  return { is_miscut: false, confidence: 0, reason: null };
}

function buildExplanation(
  grader: GraderKey,
  result: GraderCenteringResult,
  confidence: number,
  meta?: CenteringMeasurementMeta
): string {
  const cfg = getGradingCenteringConfig();
  if (confidence < cfg.minimum_confidence_for_cap) {
    return (
      "Centering could not be measured reliably from this image. " +
      "A clearer straight-on photograph would improve the estimate."
    );
  }
  if (meta?.sleeveSuspected) {
    return "A sleeve or toploader may be affecting border measurement — lay the card flat and bare for a clearer read.";
  }
  const eq = result.centering_equivalent;
  if (eq == null) return "Centering data unavailable.";
  if (result.grade_cap === "none") {
    return `Centering appears broadly consistent with a ${grader} ${eq} equivalent; it is unlikely to be the main grade-limiting factor on its own.`;
  }
  if (result.grade_cap === "soft") {
    return (
      `Front/back ratios sit near the typical ${grader} ${eq} centering guideline. ` +
      "A professional grader may interpret this borderline measurement differently."
    );
  }
  return (
    `Measured centering supports a maximum ${grader} ${eq} centering equivalent. ` +
    "Other condition factors may still reduce the overall prediction."
  );
}

/** Full centering analysis for all graders (primary grader drives top-level cap fields). */
export function analyzeCentering(
  ratios: CenteringRatios,
  meta?: CenteringMeasurementMeta,
  primaryGrader: GraderKey = "PSA"
): CenteringAnalysis {
  const hasRatios = Boolean(
    ratios.frontLR || ratios.frontTB || ratios.backLR || ratios.backTB
  );
  const axes = parseAxes(ratios);
  const conf = resolveConfidence(
    { ...meta, measured: meta?.measured ?? ratios.measured },
    hasRatios
  );
  const miscut = detectMiscut(axes, meta);

  const graderResults: Partial<Record<GraderKey, GraderCenteringResult>> = {};
  for (const g of ["ACE", "PSA", "BGS", "CGC", "TAG"] as GraderKey[]) {
    graderResults[g] = evaluateGrader(g, axes, conf.combined, meta);
  }

  const primary = graderResults[primaryGrader] ?? graderResults.PSA!;

  return {
    front_horizontal: ratios.frontLR ?? null,
    front_vertical: ratios.frontTB ?? null,
    back_horizontal: ratios.backLR ?? null,
    back_vertical: ratios.backTB ?? null,
    worst_front_axis: worstAxis(axes.frontH, axes.frontV),
    worst_back_axis: worstAxis(axes.backH, axes.backV),
    raw_centering_quality: rawCenteringQuality(axes),
    front_centering_confidence: conf.front,
    back_centering_confidence: conf.back,
    measurement_confidence: conf.combined,
    is_miscut: miscut.is_miscut,
    miscut_confidence: miscut.confidence,
    miscut_reason: miscut.reason,
    grade_cap: primary.grade_cap,
    grade_cap_value: primary.grade_cap_value,
    grade_cap_confidence: primary.grade_cap_confidence,
    explanation: buildExplanation(primaryGrader, primary, conf.combined, meta),
    grader_results: graderResults,
  };
}

/** Centering subgrade (1–10) for one grader. */
export function centeringSubgradeFor(
  grader: GraderKey,
  ratios: CenteringRatios,
  meta?: CenteringMeasurementMeta
): { score: number | null; measured: boolean; analysis: GraderCenteringResult | null } {
  if (!ratios.frontLR && !ratios.frontTB && !ratios.backLR && !ratios.backTB) {
    return { score: null, measured: false, analysis: null };
  }
  const analysis = analyzeCentering(ratios, meta, grader);
  const gr = analysis.grader_results[grader];
  return {
    score: gr?.centering_equivalent ?? null,
    measured: ratios.measured === true || meta?.measured === true,
    analysis: gr ?? null,
  };
}

export function graderKeyFromLegacy(key: string): GraderKey {
  switch (key) {
    case "Beckett":
      return "BGS";
    case "PSA":
    case "CGC":
    case "TAG":
    case "ACE":
      return key;
    default:
      return "PSA";
  }
}

export function companyToGraderKey(company: string): GraderKey {
  if (company.includes("BGS") || company.includes("Beckett")) return "BGS";
  if (company.startsWith("CGC")) return "CGC";
  if (company.startsWith("TAG")) return "TAG";
  if (company.startsWith("ACE")) return "ACE";
  return "PSA";
}

/** Collector-safe API subset — omits internal cap confidence and threshold metadata. */
export function centeringAnalysisForApi(
  analysis: CenteringAnalysis
): Record<string, unknown> {
  const graderResults: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(analysis.grader_results)) {
    if (!value) continue;
    graderResults[key] = {
      centering_equivalent: value.centering_equivalent,
      cgc_assessment: value.cgc_assessment,
      tag_score_band: value.tag_score_band,
      grade_cap: value.grade_cap,
      grade_cap_value: value.grade_cap_value,
    };
  }
  return {
    front_horizontal: analysis.front_horizontal,
    front_vertical: analysis.front_vertical,
    back_horizontal: analysis.back_horizontal,
    back_vertical: analysis.back_vertical,
    worst_front_axis: analysis.worst_front_axis,
    worst_back_axis: analysis.worst_back_axis,
    raw_centering_quality: analysis.raw_centering_quality,
    front_centering_confidence: analysis.front_centering_confidence,
    back_centering_confidence: analysis.back_centering_confidence,
    measurement_confidence: analysis.measurement_confidence,
    grade_cap: analysis.grade_cap,
    grade_cap_value: analysis.grade_cap_value,
    is_miscut: analysis.is_miscut,
    miscut_confidence: analysis.miscut_confidence,
    miscut_reason: analysis.miscut_reason,
    explanation: analysis.explanation,
    grader_results: graderResults,
  };
}
