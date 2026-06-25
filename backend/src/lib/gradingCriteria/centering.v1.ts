/**
 * Versioned grader centering criteria — single source of truth.
 * Override at runtime via GRADING_CENTERING_CONFIG_JSON (ops-only JSON merge).
 */

export type GraderKey = "ACE" | "PSA" | "BGS" | "CGC" | "TAG";
export type SourceType = "published" | "engine_interpolation";
export type ThresholdType = "explicit" | "inferred";

export interface CenteringThresholdRow {
  grader: GraderKey;
  grade: number;
  label?: string;
  front_horizontal_max: number;
  front_vertical_max: number;
  back_horizontal_max: number;
  back_vertical_max: number;
  /** BGS 9.5: one front axis ≤50/50 and the other ≤55/45 */
  bgs_dual_axis_rule?: boolean;
  is_approximate: boolean;
  source_type: SourceType;
  threshold_type: ThresholdType;
  notes?: string;
  tag_score_min?: number;
  tag_score_max?: number;
}

export interface GradingCenteringConfig {
  version: "centering.v1";
  centering_weight_by_grader: Record<GraderKey, number>;
  front_centering_weight: number;
  back_centering_weight: number;
  high_confidence_tolerance_percent: number;
  medium_confidence_tolerance_percent: number;
  minimum_confidence_for_hard_cap: number;
  minimum_confidence_for_soft_cap: number;
  /** Below this, no hard cap and reduced centering influence */
  minimum_confidence_for_cap: number;
  /** Standard TCG cut assumption for mm estimates from normalised geometry */
  standard_card_width_mm: number;
  standard_card_height_mm: number;
  thresholds: CenteringThresholdRow[];
}

function row(
  grader: GraderKey,
  grade: number,
  front: number,
  back: number,
  opts: Partial<Omit<CenteringThresholdRow, "grader" | "grade" | "front_horizontal_max" | "front_vertical_max" | "back_horizontal_max" | "back_vertical_max">> = {}
): CenteringThresholdRow {
  return {
    grader,
    grade,
    front_horizontal_max: front,
    front_vertical_max: front,
    back_horizontal_max: back,
    back_vertical_max: back,
    is_approximate: opts.is_approximate ?? false,
    source_type: opts.source_type ?? "published",
    threshold_type: opts.threshold_type ?? "explicit",
    ...opts,
  };
}

const ACE_THRESHOLDS: CenteringThresholdRow[] = [
  row("ACE", 10, 60, 60, { source_type: "published" }),
  row("ACE", 9, 65, 70),
  row("ACE", 8, 70, 75),
  row("ACE", 7, 75, 80),
  row("ACE", 6, 80, 80),
  row("ACE", 5, 80, 80),
  row("ACE", 4, 80, 80),
  row("ACE", 3, 85, 85),
  row("ACE", 2, 85, 85),
  // Grade 1: qualitative / miscut logic only — no numeric row
];

const PSA_THRESHOLDS: CenteringThresholdRow[] = [
  row("PSA", 10, 55, 75, {
    is_approximate: true,
    notes: "PSA centering limits are approximate and subject to eye appeal.",
  }),
  row("PSA", 9, 60, 90, { is_approximate: true }),
  row("PSA", 8, 65, 90, { is_approximate: true }),
  row("PSA", 7, 70, 90, { is_approximate: true }),
  row("PSA", 6, 80, 90, { is_approximate: true }),
  row("PSA", 5, 85, 90, { is_approximate: true }),
  row("PSA", 4, 85, 90, { is_approximate: true }),
  row("PSA", 3, 90, 90, { is_approximate: true }),
  row("PSA", 2, 90, 90, { is_approximate: true }),
];

const BGS_THRESHOLDS: CenteringThresholdRow[] = [
  {
    grader: "BGS",
    grade: 10,
    label: "Pristine",
    front_horizontal_max: 50,
    front_vertical_max: 50,
    back_horizontal_max: 55,
    back_vertical_max: 55,
    is_approximate: false,
    source_type: "published",
    threshold_type: "explicit",
  },
  {
    grader: "BGS",
    grade: 9.5,
    label: "Gem Mint",
    front_horizontal_max: 55,
    front_vertical_max: 55,
    back_horizontal_max: 60,
    back_vertical_max: 60,
    bgs_dual_axis_rule: true,
    is_approximate: false,
    source_type: "published",
    threshold_type: "explicit",
    notes: "One front axis ≤50/50 and the other ≤55/45.",
  },
  row("BGS", 9, 55, 70),
  row("BGS", 8, 60, 80),
  row("BGS", 7, 65, 90),
  row("BGS", 6, 70, 95),
  row("BGS", 5, 75, 95),
  row("BGS", 4, 80, 100),
  row("BGS", 3, 85, 100),
  row("BGS", 2, 90, 100, {
    notes: "Back may be fully off-centre or off-cut — cap logic only below this row.",
  }),
];

const CGC_PUBLISHED: CenteringThresholdRow[] = [
  {
    grader: "CGC",
    grade: 10,
    label: "Pristine",
    front_horizontal_max: 50,
    front_vertical_max: 50,
    back_horizontal_max: 50,
    back_vertical_max: 50,
    is_approximate: true,
    source_type: "published",
    threshold_type: "explicit",
    notes: "CGC Pristine 10 — approximately 50/50 front and back.",
  },
  row("CGC", 10, 55, 75, {
    label: "Gem Mint",
    is_approximate: false,
    notes: "CGC Gem Mint 10 published TCG thresholds.",
  }),
];

// Inferred CGC bands below Gem Mint — not official TCG rules.
const CGC_INFERRED: CenteringThresholdRow[] = [
  row("CGC", 9, 60, 90, {
    source_type: "engine_interpolation",
    threshold_type: "inferred",
    is_approximate: true,
    notes: "Inferred from holistic CGC behaviour — not published TCG thresholds.",
  }),
  row("CGC", 8, 65, 90, { source_type: "engine_interpolation", threshold_type: "inferred", is_approximate: true }),
  row("CGC", 7, 70, 90, { source_type: "engine_interpolation", threshold_type: "inferred", is_approximate: true }),
  row("CGC", 6, 80, 90, { source_type: "engine_interpolation", threshold_type: "inferred", is_approximate: true }),
  row("CGC", 5, 85, 90, { source_type: "engine_interpolation", threshold_type: "inferred", is_approximate: true }),
];

function tagRow(
  grade: number,
  front: number,
  back: number,
  tagMin: number,
  tagMax: number,
  opts: Partial<CenteringThresholdRow> = {}
): CenteringThresholdRow {
  return row("TAG", grade, front, back, {
    tag_score_min: tagMin,
    tag_score_max: tagMax,
    ...opts,
  });
}

const TAG_THRESHOLDS: CenteringThresholdRow[] = [
  {
    grader: "TAG",
    grade: 10,
    label: "Pristine",
    front_horizontal_max: 51,
    front_vertical_max: 51,
    back_horizontal_max: 52,
    back_vertical_max: 52,
    tag_score_min: 990,
    tag_score_max: 1000,
    is_approximate: false,
    source_type: "published",
    threshold_type: "explicit",
  },
  tagRow(10, 55, 65, 950, 989, { label: "Gem Mint" }),
  tagRow(9, 60, 75, 900, 949),
  tagRow(8.5, 62.5, 85, 850, 899),
  tagRow(8, 65, 95, 800, 849, {
    notes: "Below TAG 8, exact TCG back ratios are qualitative only.",
  }),
  tagRow(7.5, 67.5, 95, 750, 799, { source_type: "engine_interpolation", threshold_type: "inferred", is_approximate: true }),
  tagRow(7, 70, 95, 700, 749, { source_type: "engine_interpolation", threshold_type: "inferred", is_approximate: true }),
  tagRow(6.5, 72.5, 95, 650, 699, { source_type: "engine_interpolation", threshold_type: "inferred", is_approximate: true }),
  tagRow(6, 75, 95, 600, 649, { source_type: "engine_interpolation", threshold_type: "inferred", is_approximate: true }),
  tagRow(5.5, 77.5, 95, 550, 599, { source_type: "engine_interpolation", threshold_type: "inferred", is_approximate: true }),
  tagRow(5, 80, 95, 500, 549, { source_type: "engine_interpolation", threshold_type: "inferred", is_approximate: true }),
  tagRow(4.5, 82.5, 95, 450, 499, { source_type: "engine_interpolation", threshold_type: "inferred", is_approximate: true }),
  tagRow(4, 85, 95, 400, 449, { source_type: "engine_interpolation", threshold_type: "inferred", is_approximate: true }),
  tagRow(3.5, 87.5, 95, 350, 399, { source_type: "engine_interpolation", threshold_type: "inferred", is_approximate: true }),
  tagRow(3, 90, 95, 300, 349, { source_type: "engine_interpolation", threshold_type: "inferred", is_approximate: true }),
  tagRow(2.5, 92.5, 95, 250, 299, { source_type: "engine_interpolation", threshold_type: "inferred", is_approximate: true }),
  tagRow(2, 95, 95, 200, 249, { source_type: "engine_interpolation", threshold_type: "inferred", is_approximate: true }),
  tagRow(1.5, 98.33, 95, 150, 199, { source_type: "engine_interpolation", threshold_type: "inferred", is_approximate: true }),
];

export const DEFAULT_GRADING_CENTERING_CONFIG: GradingCenteringConfig = {
  version: "centering.v1",
  centering_weight_by_grader: {
    ACE: 0.18,
    PSA: 0.15,
    BGS: 0.25,
    CGC: 0.2,
    TAG: 0.2,
  },
  front_centering_weight: 0.7,
  back_centering_weight: 0.3,
  high_confidence_tolerance_percent: 1.0,
  medium_confidence_tolerance_percent: 2.0,
  minimum_confidence_for_hard_cap: 0.8,
  minimum_confidence_for_soft_cap: 0.6,
  minimum_confidence_for_cap: 0.55,
  standard_card_width_mm: 63,
  standard_card_height_mm: 88,
  thresholds: [
    ...ACE_THRESHOLDS,
    ...PSA_THRESHOLDS,
    ...BGS_THRESHOLDS,
    ...CGC_PUBLISHED,
    ...CGC_INFERRED,
    ...TAG_THRESHOLDS,
  ],
};

let cachedConfig: GradingCenteringConfig | null = null;

/** Load config with optional env override (GRADING_CENTERING_CONFIG_JSON). */
export function getGradingCenteringConfig(): GradingCenteringConfig {
  if (cachedConfig) return cachedConfig;
  const base = DEFAULT_GRADING_CENTERING_CONFIG;
  const raw = process.env.GRADING_CENTERING_CONFIG_JSON;
  if (raw?.trim()) {
    if (raw.length > 65_536) {
      cachedConfig = base;
      return cachedConfig;
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        cachedConfig = base;
        return cachedConfig;
      }
      const patch = parsed as Partial<GradingCenteringConfig>;
      const clampPct = (n: unknown, lo: number, hi: number) =>
        typeof n === "number" && Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : undefined;
      cachedConfig = {
        ...base,
        front_centering_weight: clampPct(patch.front_centering_weight, 0.5, 0.9) ?? base.front_centering_weight,
        back_centering_weight: clampPct(patch.back_centering_weight, 0.1, 0.5) ?? base.back_centering_weight,
        high_confidence_tolerance_percent:
          clampPct(patch.high_confidence_tolerance_percent, 0, 5) ?? base.high_confidence_tolerance_percent,
        medium_confidence_tolerance_percent:
          clampPct(patch.medium_confidence_tolerance_percent, 0, 8) ??
          base.medium_confidence_tolerance_percent,
        minimum_confidence_for_hard_cap:
          clampPct(patch.minimum_confidence_for_hard_cap, 0.5, 1) ?? base.minimum_confidence_for_hard_cap,
        minimum_confidence_for_soft_cap:
          clampPct(patch.minimum_confidence_for_soft_cap, 0.4, 1) ?? base.minimum_confidence_for_soft_cap,
        minimum_confidence_for_cap:
          clampPct(patch.minimum_confidence_for_cap, 0.3, 1) ?? base.minimum_confidence_for_cap,
        centering_weight_by_grader: {
          ...base.centering_weight_by_grader,
          ...(patch.centering_weight_by_grader &&
          typeof patch.centering_weight_by_grader === "object" &&
          !Array.isArray(patch.centering_weight_by_grader)
            ? Object.fromEntries(
                (["ACE", "PSA", "BGS", "CGC", "TAG"] as GraderKey[]).map((g) => {
                  const w = (patch.centering_weight_by_grader as Record<string, unknown>)[g];
                  const clamped = clampPct(w, 0.05, 0.4);
                  return [g, clamped ?? base.centering_weight_by_grader[g]];
                })
              )
            : {}),
        },
        thresholds: base.thresholds,
      };
      return cachedConfig;
    } catch {
      // fall through to default
    }
  }
  cachedConfig = base;
  return cachedConfig;
}

/** Threshold rows for one grader, highest grade first. */
export function thresholdsForGrader(grader: GraderKey): CenteringThresholdRow[] {
  return getGradingCenteringConfig()
    .thresholds.filter((t) => t.grader === grader)
    .sort((a, b) => b.grade - a.grade);
}

export const GRADING_CENTERING_CONFIG = DEFAULT_GRADING_CENTERING_CONFIG;
