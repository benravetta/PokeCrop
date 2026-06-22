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

// Larger-side percentage from a "55/45" ratio string (already larger-first, but
// we re-derive defensively).
function largerPct(ratio: string): number | null {
  const m = /^(\d{1,3})\s*\/\s*(\d{1,3})$/.exec(ratio.trim());
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a + b <= 0) return null;
  return Math.round((Math.max(a, b) / (a + b)) * 100);
}

// PSA-style centering tolerance → a 0-10 centering score. Front is strict; back
// is lenient. The worst axis on each present side sets that side's ceiling.
const FRONT_TIERS: [number, number][] = [
  [55, 10],
  [60, 9],
  [65, 8],
  [70, 7],
  [75, 6],
  [80, 5],
];
const BACK_TIERS: [number, number][] = [
  [75, 10],
  [80, 9],
  [85, 8],
  [90, 7],
  [95, 6],
];

function ceilFromWorst(worst: number, side: "front" | "back"): number {
  const tiers = side === "front" ? FRONT_TIERS : BACK_TIERS;
  for (const [maxPct, grade] of tiers) if (worst <= maxPct) return grade;
  return side === "front" ? 4 : 5;
}

function centeringScore(findings: Json): { score: number | null; measured: boolean } {
  const c = asObj(findings.centering);
  const measured = c.measured === true;
  const sides: number[] = [];
  const fr = [largerPct(asStr(c.front_left_right)), largerPct(asStr(c.front_top_bottom))].filter(
    (n): n is number => n != null
  );
  const bk = [largerPct(asStr(c.back_left_right)), largerPct(asStr(c.back_top_bottom))].filter(
    (n): n is number => n != null
  );
  if (fr.length) sides.push(ceilFromWorst(Math.max(...fr), "front"));
  if (bk.length) sides.push(ceilFromWorst(Math.max(...bk), "back"));
  return { score: sides.length ? Math.min(...sides) : null, measured };
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

function resolveAxes(findings: Json): AxisScores {
  const corners = scoreOf(findings.corners);
  const edges = scoreOf(findings.edges);
  const surface = scoreOf(findings.surface);
  const eye = scoreOf(findings.eye_appeal);
  const { score: cent } = centeringScore(findings);

  const present = [corners, edges, surface].filter((n): n is number => n != null);
  const fallback = present.length ? present.reduce((a, b) => a + b, 0) / present.length : 8;

  // Unmeasured centering can't be claimed as perfect; cap the assumption at 9.
  const centeringKnown = cent != null;
  const centering = cent != null ? cent : Math.min(9, fallback);

  return {
    centering: clamp(centering, 1, 10),
    corners: clamp(corners ?? fallback, 1, 10),
    edges: clamp(edges ?? fallback, 1, 10),
    surface: clamp(surface ?? fallback, 1, 10),
    centeringKnown,
    eyeAppeal: eye,
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
}

export interface ScoreResult {
  axes: AxisScores;
  caps: CapResult;
  company_estimates: CompanyEstimate[];
}

export function scoreGrades(findings: Json): ScoreResult {
  const axes = resolveAxes(findings);
  const caps = detectCaps(findings);
  const cap = caps.overallCap;
  const applyCap = (v: number) => (cap != null ? Math.min(v, cap) : v);

  const subs = [axes.centering, axes.corners, axes.edges, axes.surface];
  const lo = Math.min(...subs);
  const mean = subs.reduce((a, b) => a + b, 0) / subs.length;

  const estimates: CompanyEstimate[] = [];

  const build = (
    company: CompanyKey,
    likelyNum: number,
    subgradeFmt: ((v: number) => string) | null,
    downStep: number,
    fmt: (v: number) => string
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
      top_grade_likelihood: topLikelihood(likely, axes.centeringKnown, false),
      subgrades: subgradeFmt
        ? {
            centering: subgradeFmt(axes.centering),
            corners: subgradeFmt(axes.corners),
            edges: subgradeFmt(axes.edges),
            surface: subgradeFmt(axes.surface),
          }
        : null,
    };
  };

  // PSA — holistic whole grade, pulled hard toward the weakest aspect. A gem 10
  // demands every aspect essentially flawless.
  let psa = 0.55 * lo + 0.45 * mean;
  if (lo < 9.5) psa = Math.min(psa, 9);
  if (lo < 8.5) psa = Math.min(psa, 8);
  estimates.push(
    build("PSA", clamp(toWhole(psa), 1, 10), null, 1, (v) => `PSA ${toWhole(v)}`)
  );

  // BGS — final ≈ weighted blend but never more than ~1 above the lowest sub.
  const bgsBlend = Math.min(0.35 * lo + 0.65 * mean, lo + 1.0);
  estimates.push(
    build(
      "Beckett (BGS)",
      toHalf(clamp(bgsBlend, 1, 10)),
      (v) => halfStr(toHalf(v)),
      1,
      (v) => `BGS ${halfStr(toHalf(v))}`
    )
  );

  // CGC — strict; final tracks close to the lowest subgrade.
  const cgcBlend = Math.min(lo + 0.5, 0.7 * lo + 0.3 * mean);
  estimates.push(
    build(
      "CGC",
      toHalf(clamp(cgcBlend, 1, 10)),
      (v) => halfStr(toHalf(v)),
      1,
      (v) => `CGC ${halfStr(toHalf(v))}`
    )
  );

  // TAG — granular CV point score, ~PSA strictness.
  const tagBlend = 0.5 * lo + 0.5 * mean;
  estimates.push(
    build(
      "TAG",
      toDec1(clamp(tagBlend, 1, 10)),
      (v) => toDec1(v).toFixed(1),
      0.5,
      (v) => `TAG ${toDec1(v).toFixed(1)}`
    )
  );

  // ACE — granular AI grade, slightly more forgiving on centering.
  const aceCentering = Math.min(10, axes.centering + 0.3);
  const aceLo = Math.min(aceCentering, axes.corners, axes.edges, axes.surface);
  const aceMean = (aceCentering + axes.corners + axes.edges + axes.surface) / 4;
  const aceBlend = 0.5 * aceLo + 0.5 * aceMean;
  estimates.push(
    build(
      "ACE",
      toDec1(clamp(aceBlend, 1, 10)),
      (v) => toDec1(v).toFixed(1),
      0.5,
      (v) => `ACE ${toDec1(v).toFixed(1)}`
    )
  );

  return { axes, caps, company_estimates: estimates };
}
