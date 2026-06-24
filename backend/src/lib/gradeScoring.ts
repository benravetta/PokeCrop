import { detectBgsTier, formatBgsLikely, type BgsTier } from "./bgsTier.js";
import {
  centeringGradeFor,
  ratiosFromFindings,
  type GraderCenteringKey,
} from "./centeringRules.js";

// Deterministic subgrade + final-grade engine.
//
// The vision inspection produces per-axis condition scores (0-10) and findings;
// this module turns them into CONSISTENT numeric subgrades and a final grade on
// each grading company's own scale, applying the same hard caps the adjudicator
// describes so the headline numbers can never contradict the findings (a torn
// card can never read as a 7). The language model still does all perception and
// writes the human-facing reasoning — only the numbers are made rigorous here.
//
// Each company is modelled from how it actually behaves:
//   - PSA   — whole 1-10, holistic, heavily weighted to the weakest aspect.
//   - BGS   — 0.5 steps, four subgrades; final ≈ a blend held within ~1 of the
//             lowest subgrade (Pristine/Black Label need near-perfect subs).
//   - CGC   — 0.5 steps; strict, final tracks close to the lowest subgrade.
//   - TAG   — one-decimal CV point score; granular, ~PSA strictness.
//   - ACE   — one-decimal AI grade; granular, slightly forgiving of centering.

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

// ---- per-axis condition (0-10) -------------------------------------------

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

/** Per-grader centering subgrade from measured ratios or a conservative fallback. */
function centeringFor(
  findings: Json,
  grader: GraderCenteringKey,
  fallback: number
): { score: number; known: boolean } {
  const ratios = ratiosFromFindings(asObj(findings.centering));
  const { score, measured } = centeringGradeFor(ratios, grader);
  if (score != null) {
    return { score: clamp(score, 1, 10), known: measured || hasRatioData(findings) };
  }
  return { score: clamp(Math.min(9, fallback), 1, 10), known: false };
}

// ---- structural / condition caps -----------------------------------------

export interface CapResult {
  overallCap: number | null; // max grade any company may reach
  authenticOnly: boolean; // torn / missing material / altered → not gradeable
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

  // Defects array can also reveal structural breaks the inspector listed there.
  for (const dd of asArr(findings.defects).map(asObj)) {
    const kind = asStr(dd.kind).toLowerCase();
    const sev = asStr(dd.severity).toLowerCase();
    if ((kind === "tear" || kind === "hole") && sev !== "minor") lower(2, `${kind}`);
    if (kind === "crease" && sev !== "minor") lower(5, "crease");
  }

  return { overallCap: cap, authenticOnly, reasons };
}

// ---- per-company grade synthesis ------------------------------------------

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

function topLikelihood(
  likely: number,
  centeringKnown: boolean,
  authenticOnly: boolean
): string {
  if (authenticOnly) return "very_low";
  let band: string;
  if (likely >= 9.5) band = "high";
  else if (likely >= 9) band = "medium";
  else if (likely >= 8) band = "low";
  else band = "very_low";
  // Without a measured/visible centering read, never claim a confident gem.
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
  /** Beckett-only: Black Label (all 10s) or Pristine 10 (all ≥9.5, final 10). */
  bgs_tier?: BgsTier;
}

export interface ScoreResult {
  axes: AxisScores;
  caps: CapResult;
  company_estimates: CompanyEstimate[];
}

function subsFor(
  findings: Json,
  axes: RawAxes,
  grader: GraderCenteringKey
): { subs: number[]; centeringKnown: boolean; centering: number } {
  const { score: centering, known } = centeringFor(findings, grader, axes.fallback);
  return {
    centering,
    centeringKnown: known,
    subs: [centering, axes.corners, axes.edges, axes.surface],
  };
}

export function scoreGrades(findings: Json): ScoreResult {
  const axes = resolveAxes(findings);
  const caps = detectCaps(findings);
  const cap = caps.overallCap;
  const applyCap = (v: number) => (cap != null ? Math.min(v, cap) : v);

  const estimates: CompanyEstimate[] = [];

  const build = (
    company: CompanyKey,
    likelyNum: number,
    subgradeFmt: ((v: number) => string) | null,
    downStep: number,
    fmt: (v: number) => string,
    centeringKnown: boolean,
    subs: number[]
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
      };
    }
    const likely = clamp(applyCap(likelyNum), 1, 10);
    const low = clamp(likely - downStep, 1, 10);
    return {
      company,
      scale: SCALES[company],
      low: fmt(low),
      likely: fmt(likely),
      high: fmt(likely), // anti-hype: our likely is already the best plausible read
      top_grade_likelihood: topLikelihood(likely, centeringKnown, false),
      subgrades: subgradeFmt
        ? {
            centering: subgradeFmt(subs[0]),
            corners: subgradeFmt(subs[1]),
            edges: subgradeFmt(subs[2]),
            surface: subgradeFmt(subs[3]),
          }
        : null,
    };
  };

  const psaSubs = subsFor(findings, axes, "PSA");
  const psaLo = Math.min(...psaSubs.subs);
  const psaMean = psaSubs.subs.reduce((a, b) => a + b, 0) / psaSubs.subs.length;
  let psa = 0.55 * psaLo + 0.45 * psaMean;
  if (psaLo < 9.5) psa = Math.min(psa, 9);
  if (psaLo < 8.5) psa = Math.min(psa, 8);
  estimates.push(
    build(
      "PSA",
      clamp(toWhole(psa), 1, 10),
      null,
      1,
      (v) => `PSA ${toWhole(v)}`,
      psaSubs.centeringKnown,
      psaSubs.subs
    )
  );

  const bgsSubs = subsFor(findings, axes, "Beckett");
  const bgsLo = Math.min(...bgsSubs.subs);
  const bgsMean = bgsSubs.subs.reduce((a, b) => a + b, 0) / bgsSubs.subs.length;
  const bgsBlend = Math.min(0.35 * bgsLo + 0.65 * bgsMean, bgsLo + 1.0);
  const bgsLikelyNum = toHalf(clamp(bgsBlend, 1, 10));
  const bgsTier = detectBgsTier(bgsSubs.subs, bgsLikelyNum);
  const bgsFmt = (v: number) => `BGS ${halfStr(toHalf(v))}`;
  const bgsEstimate = build(
    "Beckett (BGS)",
    bgsLikelyNum,
    (v) => halfStr(toHalf(v)),
    1,
    (v) => formatBgsLikely(v, bgsTier, bgsFmt),
    bgsSubs.centeringKnown,
    bgsSubs.subs
  );
  if (bgsTier) {
    bgsEstimate.bgs_tier = bgsTier;
  }
  estimates.push(bgsEstimate);

  const cgcSubs = subsFor(findings, axes, "CGC");
  const cgcLo = Math.min(...cgcSubs.subs);
  const cgcMean = cgcSubs.subs.reduce((a, b) => a + b, 0) / cgcSubs.subs.length;
  const cgcBlend = Math.min(cgcLo + 0.5, 0.7 * cgcLo + 0.3 * cgcMean);
  estimates.push(
    build(
      "CGC",
      toHalf(clamp(cgcBlend, 1, 10)),
      (v) => halfStr(toHalf(v)),
      1,
      (v) => `CGC ${halfStr(toHalf(v))}`,
      cgcSubs.centeringKnown,
      cgcSubs.subs
    )
  );

  const tagSubs = subsFor(findings, axes, "TAG");
  const tagLo = Math.min(...tagSubs.subs);
  const tagMean = tagSubs.subs.reduce((a, b) => a + b, 0) / tagSubs.subs.length;
  const tagBlend = 0.5 * tagLo + 0.5 * tagMean;
  estimates.push(
    build(
      "TAG",
      toDec1(clamp(tagBlend, 1, 10)),
      (v) => toDec1(v).toFixed(1),
      0.5,
      (v) => `TAG ${toDec1(v).toFixed(1)}`,
      tagSubs.centeringKnown,
      tagSubs.subs
    )
  );

  const aceSubs = subsFor(findings, axes, "ACE");
  const aceLo = Math.min(...aceSubs.subs);
  const aceMean = aceSubs.subs.reduce((a, b) => a + b, 0) / aceSubs.subs.length;
  const aceBlend = 0.5 * aceLo + 0.5 * aceMean;
  estimates.push(
    build(
      "ACE",
      toDec1(clamp(aceBlend, 1, 10)),
      (v) => toDec1(v).toFixed(1),
      0.5,
      (v) => `ACE ${toDec1(v).toFixed(1)}`,
      aceSubs.centeringKnown,
      aceSubs.subs
    )
  );

  const psaCentering = centeringFor(findings, "PSA", axes.fallback);
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
  };
}
