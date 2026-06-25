import { detectBgsTier, formatBgsLikely, type BgsTier } from "./bgsTier.js";
import { ratiosFromFindings, type GraderCenteringKey } from "./centeringRules.js";
import {
  analyzeCentering,
  centeringSubgradeFor,
  companyToGraderKey,
  type CenteringMeasurementMeta,
  type GradeCapType,
} from "./centeringEngine.js";
import { getGradingCenteringConfig, type GraderKey } from "./gradingCriteria/index.js";

type Json = Record<string, unknown>;

const asObj = (v: unknown): Json =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {};
const asStr = (v: unknown): string => (typeof v === "string" ? v : "");
const asArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

const clamp = (v: number, lo = 1, hi = 10) => Math.max(lo, Math.min(hi, v));
const toHalf = (v: number) => Math.round(v * 2) / 2;
const toDec1 = (v: number) => Math.round(v * 10) / 10;
const toWhole = (v: number) => Math.round(v);

function halfStr(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function scoreOf(v: unknown): number | null {
  const o = asObj(v);
  const raw = o.score;
  const n =
    typeof raw === "number" ? raw : typeof raw === "string" ? parseFloat(raw) : NaN;
  return Number.isFinite(n) ? clamp(n, 0, 10) : null;
}

function hasRatioData(findings: Json): boolean {
  const r = ratiosFromFindings(asObj(findings.centering));
  return Boolean(r.frontLR || r.frontTB || r.backLR || r.backTB);
}

function centeringMetaFromFindings(findings: Json): CenteringMeasurementMeta | undefined {
  const mc = findings.measured_centering;
  if (!mc || typeof mc !== "object") {
    return asObj(findings.centering).measured === true ? { measured: true } : undefined;
  }
  const m = mc as Record<string, unknown>;
  return {
    measured: true,
    front_centering_confidence:
      typeof m.front_centering_confidence === "number" ? m.front_centering_confidence : undefined,
    back_centering_confidence:
      typeof m.back_centering_confidence === "number" ? m.back_centering_confidence : undefined,
    measurement_confidence:
      typeof m.measurement_confidence === "number" ? m.measurement_confidence : undefined,
    detectionQuality:
      m.detectionQuality === "good" || m.detectionQuality === "fair" || m.detectionQuality === "poor"
        ? m.detectionQuality
        : undefined,
    perspectiveWarning: m.perspectiveWarning === true,
    sleeveSuspected: m.sleeveSuspected === true,
    lowContrastBorder: m.lowContrastBorder === true,
    borderlessDesign: m.borderlessDesign === true,
    printSheetVisible: m.printSheetVisible === true,
  };
}

function centeringFor(
  findings: Json,
  grader: GraderCenteringKey,
  fallback: number,
  cached?: ReturnType<typeof analyzeCentering>
): { score: number; known: boolean; cap: GradeCapType; capValue: number | null } {
  const ratios = ratiosFromFindings(asObj(findings.centering));
  const meta = centeringMetaFromFindings(findings);
  const key: GraderKey = grader === "Beckett" ? "BGS" : (grader as GraderKey);
  const gr = cached?.grader_results[key];
  if (gr?.centering_equivalent != null) {
    return {
      score: clamp(gr.centering_equivalent, 1, 10),
      known: ratios.measured === true || meta?.measured === true || hasRatioData(findings),
      cap: gr.grade_cap ?? "none",
      capValue: gr.grade_cap_value ?? null,
    };
  }
  const { score, measured, analysis } = centeringSubgradeFor(key, ratios, meta);
  if (score != null) {
    return {
      score: clamp(score, 1, 10),
      known: measured || hasRatioData(findings),
      cap: analysis?.grade_cap ?? "none",
      capValue: analysis?.grade_cap_value ?? null,
    };
  }
  return {
    score: clamp(Math.min(9, fallback), 1, 10),
    known: false,
    cap: "none",
    capValue: null,
  };
}

export interface CapResult {
  overallCap: number | null;
  authenticOnly: boolean;
  reasons: string[];
}

function detectCaps(findings: Json): CapResult {
  const reasons: string[] = [];
  let cap: number | null = null;
  let authenticOnly = false;
  const lower = (v: number, why: string) => {
    if (cap == null || v < cap) cap = v;
    reasons.push(why);
  };

  const dmg = asArr(findings.structural_damage).map(asObj);
  let creases = 0;
  for (const d of dmg) {
    const type = asStr(d.type).toLowerCase();
    const sev = asStr(d.severity).toLowerCase();
    if (sev === "minor" && (type === "indentation" || type === "bend")) {
      lower(8, `${type} (minor)`);
      continue;
    }
    switch (type) {
      case "tear":
      case "rip":
      case "split":
      case "hole":
        lower(2, `${type} in the card`);
        break;
      case "missing_piece":
      case "paper_loss":
      case "trimmed":
      case "altered":
        authenticOnly = true;
        reasons.push(`${type} — not gradeable as mint`);
        break;
      case "crease":
      case "fold":
        creases += 1;
        break;
      case "bend":
        lower(7, "bend in the stock");
        break;
      case "indentation":
        lower(8, "indentation / pressure mark");
        break;
      case "water_damage":
      case "stain":
        lower(4, `${type}`);
        break;
      case "tape":
      case "adhesive":
        lower(4, `${type} residue`);
        break;
      case "writing":
        lower(3, "writing on the card");
        break;
      default:
        break;
    }
  }
  if (creases >= 2) lower(3, "multiple creases / folds");
  else if (creases === 1) lower(5, "crease / fold");

  for (const dd of asArr(findings.defects).map(asObj)) {
    const kind = asStr(dd.kind).toLowerCase();
    const sev = asStr(dd.severity).toLowerCase();
    if ((kind === "tear" || kind === "hole") && sev !== "minor") lower(2, `${kind}`);
    if (kind === "crease" && sev !== "minor") lower(5, "crease");
  }

  return { overallCap: cap, authenticOnly, reasons };
}

function printScore(findings: Json, fallback: number): number {
  const obs = asArr(findings.observations).map(asObj);
  let penalty = 0;
  for (const o of obs) {
    if (asStr(o.likely) === "factory") {
      const sev = asStr(o.severity).toLowerCase();
      if (sev === "major") penalty += 2;
      else if (sev === "moderate") penalty += 1;
      else penalty += 0.5;
    }
  }
  return penalty === 0 ? 8 : clamp(fallback - penalty, 1, 10);
}

export interface AxisScores {
  centering: number;
  corners: number;
  edges: number;
  surface: number;
  centeringKnown: boolean;
  eyeAppeal: number | null;
}

interface RawAxes {
  corners: number;
  edges: number;
  surface: number;
  eyeAppeal: number | null;
  print: number;
  fallback: number;
}

function resolveAxes(findings: Json): RawAxes {
  const corners = scoreOf(findings.corners);
  const edges = scoreOf(findings.edges);
  const surface = scoreOf(findings.surface);
  const eye = scoreOf(findings.eye_appeal);

  const present = [corners, edges, surface].filter((n): n is number => n != null);
  const fallback = present.length ? present.reduce((a, b) => a + b, 0) / present.length : 8;

  return {
    corners: clamp(corners ?? fallback, 1, 10),
    edges: clamp(edges ?? fallback, 1, 10),
    surface: clamp(surface ?? fallback, 1, 10),
    eyeAppeal: eye,
    print: printScore(findings, fallback),
    fallback,
  };
}

type CompanyKey = "PSA" | "Beckett (BGS)" | "CGC" | "TAG" | "ACE";

const SCALES: Record<CompanyKey, string> = {
  PSA: "Whole 1-10 (no subgrades)",
  "Beckett (BGS)": "0.5 steps 1-10, four subgrades",
  CGC: "0.5 steps 1-10, subgrades",
  TAG: "One-decimal 1-10",
  ACE: "One-decimal 1-10",
};

function legacyGraderKey(company: CompanyKey): GraderCenteringKey {
  if (company === "Beckett (BGS)") return "Beckett";
  return company;
}

interface CategoryWeights {
  surface: number;
  corners: number;
  edges: number;
  centering: number;
  print: number;
  eyeAppeal: number;
}

function categoryWeightsFor(company: CompanyKey): CategoryWeights {
  const cfg = getGradingCenteringConfig();
  const gk = companyToGraderKey(company);
  const centering = cfg.centering_weight_by_grader[gk];
  const print = 0.05;
  const eyeAppeal = 0.05;
  const sceTotal = 1 - centering - print - eyeAppeal;
  const baseSce = 0.72;
  return {
    surface: (sceTotal * 0.3) / baseSce,
    corners: (sceTotal * 0.22) / baseSce,
    edges: (sceTotal * 0.2) / baseSce,
    centering,
    print,
    eyeAppeal,
  };
}

function weightedGrade(
  axes: RawAxes,
  centeringScore: number,
  centeringKnown: boolean,
  meta: CenteringMeasurementMeta | undefined,
  weights: CategoryWeights
): number {
  let cWeight = weights.centering;
  const conf = meta?.measurement_confidence ?? (centeringKnown ? 0.85 : 0.5);
  const cfg = getGradingCenteringConfig();
  if (conf < cfg.minimum_confidence_for_cap) cWeight *= 0.35;

  const eye = axes.eyeAppeal ?? axes.fallback;
  return clamp(
    axes.surface * weights.surface +
      axes.corners * weights.corners +
      axes.edges * weights.edges +
      centeringScore * cWeight +
      axes.print * weights.print +
      eye * weights.eyeAppeal,
    1,
    10
  );
}

function applyCenteringCeiling(
  likely: number,
  cap: GradeCapType,
  capValue: number | null,
  useHalfSteps: boolean
): number {
  if (cap === "none" || capValue == null) return likely;
  const buffer = cap === "soft" ? (useHalfSteps ? 0.5 : 1) : 0;
  return Math.min(likely, capValue + buffer);
}

function topLikelihood(likely: number, centeringKnown: boolean, authenticOnly: boolean): string {
  if (authenticOnly) return "very_low";
  let band: string;
  if (likely >= 9.5) band = "high";
  else if (likely >= 9) band = "medium";
  else if (likely >= 8) band = "low";
  else band = "very_low";
  if (!centeringKnown && band === "high") band = "medium";
  return band;
}

interface CompanyEstimate {
  company: string;
  scale: string;
  low: string;
  likely: string;
  high: string;
  top_grade_likelihood: string;
  subgrades: { centering: string; corners: string; edges: string; surface: string } | null;
  bgs_tier?: BgsTier;
  predicted_range?: [number, number] | null;
}

export interface ScoreResult {
  axes: AxisScores;
  caps: CapResult;
  company_estimates: CompanyEstimate[];
  centering_analysis?: ReturnType<typeof analyzeCentering>;
}

function subsFor(
  findings: Json,
  axes: RawAxes,
  grader: GraderCenteringKey,
  cached?: ReturnType<typeof analyzeCentering>
): {
  subs: number[];
  centeringKnown: boolean;
  centering: number;
  cap: GradeCapType;
  capValue: number | null;
} {
  const { score: centering, known, cap, capValue } = centeringFor(
    findings,
    grader,
    axes.fallback,
    cached
  );
  return {
    centering,
    centeringKnown: known,
    cap,
    capValue,
    subs: [centering, axes.corners, axes.edges, axes.surface],
  };
}

function predictedRange(likely: number, downStep: number): [number, number] {
  const lo = clamp(likely - downStep, 1, 10);
  return [lo, likely];
}

function computeLikely(
  company: CompanyKey,
  findings: Json,
  axes: RawAxes,
  meta: CenteringMeasurementMeta | undefined,
  useHalf: boolean,
  cached?: ReturnType<typeof analyzeCentering>
): { likelyNum: number; sub: ReturnType<typeof subsFor> } {
  const gk = legacyGraderKey(company);
  const sub = subsFor(findings, axes, gk, cached);
  const weights = categoryWeightsFor(company);
  let weighted = weightedGrade(axes, sub.centering, sub.centeringKnown, meta, weights);

  const lo = Math.min(...sub.subs);
  const mean = sub.subs.reduce((a, b) => a + b, 0) / sub.subs.length;
  const legacyBlend = company === "Beckett (BGS)" ? 0.35 * lo + 0.65 * mean : 0.45 * lo + 0.55 * mean;
  weighted = Math.max(weighted, legacyBlend * 0.92);

  weighted = applyCenteringCeiling(weighted, sub.cap, sub.capValue, useHalf);

  let likelyNum = useHalf ? toHalf(weighted) : company === "PSA" ? toWhole(weighted) : toDec1(weighted);
  if (company === "PSA" && lo < 9.5 && likelyNum > 9) likelyNum = 9;

  return { likelyNum: clamp(likelyNum, 1, 10), sub };
}

export function scoreGrades(findings: Json): ScoreResult {
  const axes = resolveAxes(findings);
  const caps = detectCaps(findings);
  const structuralCap = caps.overallCap;
  const applyStructuralCap = (v: number) =>
    structuralCap != null ? Math.min(v, structuralCap) : v;
  const meta = centeringMetaFromFindings(findings);
  const ratios = ratiosFromFindings(asObj(findings.centering));
  const centeringAnalysis = hasRatioData(findings)
    ? analyzeCentering(ratios, meta, "PSA")
    : undefined;

  const estimates: CompanyEstimate[] = [];

  const build = (
    company: CompanyKey,
    likelyNum: number,
    subgradeFmt: ((v: number) => string) | null,
    downStep: number,
    fmt: (v: number) => string,
    sub: ReturnType<typeof subsFor>,
    bgsTier?: BgsTier | null
  ): CompanyEstimate => {
    if (caps.authenticOnly) {
      return {
        company,
        scale: SCALES[company],
        low: "Authentic / Altered",
        likely: "Authentic / Altered",
        high: "Authentic / Altered",
        top_grade_likelihood: "very_low",
        subgrades: null,
        predicted_range: null,
      };
    }
    const likely = clamp(applyStructuralCap(likelyNum), 1, 10);
    const low = clamp(likely - downStep, 1, 10);
    const est: CompanyEstimate = {
      company,
      scale: SCALES[company],
      low: fmt(low),
      likely:
        company === "Beckett (BGS)" && bgsTier
          ? formatBgsLikely(likely, bgsTier, fmt)
          : fmt(likely),
      high: fmt(likely),
      top_grade_likelihood: topLikelihood(likely, sub.centeringKnown, false),
      subgrades: subgradeFmt
        ? {
            centering: subgradeFmt(sub.subs[0]),
            corners: subgradeFmt(sub.subs[1]),
            edges: subgradeFmt(sub.subs[2]),
            surface: subgradeFmt(sub.subs[3]),
          }
        : null,
      predicted_range: predictedRange(likely, downStep),
    };
    if (bgsTier) est.bgs_tier = bgsTier;
    return est;
  };

  {
    const { likelyNum, sub } = computeLikely("PSA", findings, axes, meta, false, centeringAnalysis);
    estimates.push(
      build("PSA", likelyNum, null, 1, (v) => `PSA ${toWhole(v)}`, sub)
    );
  }

  {
    const { likelyNum, sub } = computeLikely("Beckett (BGS)", findings, axes, meta, true, centeringAnalysis);
    const capped = applyStructuralCap(likelyNum);
    const bgsTier = detectBgsTier(sub.subs, capped);
    estimates.push(
      build(
        "Beckett (BGS)",
        capped,
        (v) => halfStr(toHalf(v)),
        1,
        (v) => `BGS ${halfStr(toHalf(v))}`,
        sub,
        bgsTier
      )
    );
  }

  {
    const { likelyNum, sub } = computeLikely("CGC", findings, axes, meta, true, centeringAnalysis);
    estimates.push(
      build(
        "CGC",
        applyStructuralCap(likelyNum),
        (v) => halfStr(toHalf(v)),
        1,
        (v) => `CGC ${halfStr(toHalf(v))}`,
        sub
      )
    );
  }

  {
    const { likelyNum, sub } = computeLikely("TAG", findings, axes, meta, false, centeringAnalysis);
    estimates.push(
      build(
        "TAG",
        applyStructuralCap(likelyNum),
        (v) => toDec1(v).toFixed(1),
        0.5,
        (v) => `TAG ${toDec1(v).toFixed(1)}`,
        sub
      )
    );
  }

  {
    const { likelyNum, sub } = computeLikely("ACE", findings, axes, meta, false, centeringAnalysis);
    estimates.push(
      build(
        "ACE",
        applyStructuralCap(likelyNum),
        (v) => toDec1(v).toFixed(1),
        0.5,
        (v) => `ACE ${toDec1(v).toFixed(1)}`,
        sub
      )
    );
  }

  const psaCentering = centeringFor(findings, "PSA", axes.fallback, centeringAnalysis);
  return {
    axes: {
      corners: axes.corners,
      edges: axes.edges,
      surface: axes.surface,
      centering: psaCentering.score,
      centeringKnown: psaCentering.known,
      eyeAppeal: axes.eyeAppeal,
    },
    caps,
    company_estimates: estimates,
    centering_analysis: centeringAnalysis,
  };
}
