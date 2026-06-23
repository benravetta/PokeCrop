// Published centering tolerance tables → a 0-10 centering subgrade.
// Worst axis on each present side sets that side's ceiling; the lower of front/back
// wins. Ratios are "larger/smaller" strings like "55/45".

export interface CenteringRatios {
  frontLR?: string;
  frontTB?: string;
  backLR?: string;
  backTB?: string;
  measured?: boolean;
}

type Tier = [maxWorstAxisPct: number, gradeOn10Scale: number];

// PSA Gem Mint 10: front ≤55/45, back ≤75/25 (public scale).
const PSA_FRONT: Tier[] = [
  [55, 10],
  [60, 9],
  [65, 8],
  [70, 7],
  [75, 6],
  [80, 5],
];
const PSA_BACK: Tier[] = [
  [75, 10],
  [80, 9],
  [85, 8],
  [90, 7],
  [95, 6],
];

// Beckett public scale snippets (stricter at the top).
const BECKETT_FRONT: Tier[] = [
  [50, 10], // 9.5 Black Label territory
  [55, 9],
  [60, 8],
  [65, 7],
  [70, 6],
  [75, 5],
];
const BECKETT_BACK: Tier[] = [
  [55, 10],
  [70, 9],
  [80, 8],
  [85, 7],
  [90, 6],
];

// TAG TCG published rubric (Pristine / Gem / Mint bands).
const TAG_FRONT: Tier[] = [
  [51, 10],
  [55, 9],
  [60, 8],
  [65, 7],
  [75, 6],
  [80, 5],
];
const TAG_BACK: Tier[] = [
  [52, 10],
  [65, 9],
  [75, 8],
  [80, 7],
  [85, 6],
];

// ACE published centering thresholds (front/back).
const ACE_FRONT: Tier[] = [
  [60, 10],
  [65, 9],
  [70, 8],
  [75, 7],
  [80, 6],
  [85, 5],
  [90, 4],
];
const ACE_BACK: Tier[] = [
  [70, 10],
  [75, 9],
  [80, 8],
  [85, 7],
  [90, 6],
];

// CGC does not publish a detailed table; use PSA-like tiers (conservative).
const CGC_FRONT = PSA_FRONT;
const CGC_BACK = PSA_BACK;

export type GraderCenteringKey = "PSA" | "Beckett" | "CGC" | "TAG" | "ACE";

const TABLES: Record<
  GraderCenteringKey,
  { front: Tier[]; back: Tier[]; defaultFloor: number }
> = {
  PSA: { front: PSA_FRONT, back: PSA_BACK, defaultFloor: 4 },
  Beckett: { front: BECKETT_FRONT, back: BECKETT_BACK, defaultFloor: 5 },
  CGC: { front: CGC_FRONT, back: CGC_BACK, defaultFloor: 4 },
  TAG: { front: TAG_FRONT, back: TAG_BACK, defaultFloor: 5 },
  ACE: { front: ACE_FRONT, back: ACE_BACK, defaultFloor: 4 },
};

export function largerPct(ratio: string): number | null {
  const m = /^(\d{1,3})\s*\/\s*(\d{1,3})$/.exec(ratio.trim());
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a + b <= 0) return null;
  return Math.round((Math.max(a, b) / (a + b)) * 100);
}

function ceilFromWorst(worstPct: number, tiers: Tier[], floor: number): number {
  for (const [maxPct, grade] of tiers) {
    if (worstPct <= maxPct) return grade;
  }
  return floor;
}

function sideScore(
  lr: string | undefined,
  tb: string | undefined,
  tiers: Tier[],
  floor: number
): number | null {
  const pcts = [lr, tb].map((r) => (r ? largerPct(r) : null)).filter((n): n is number => n != null);
  if (!pcts.length) return null;
  return ceilFromWorst(Math.max(...pcts), tiers, floor);
}

/** Extract ratio strings from inspection findings.centering object. */
export function ratiosFromFindings(centering: Record<string, unknown>): CenteringRatios {
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  return {
    frontLR: str(centering.front_left_right),
    frontTB: str(centering.front_top_bottom),
    backLR: str(centering.back_left_right),
    backTB: str(centering.back_top_bottom),
    measured: centering.measured === true,
  };
}

/** Centering subgrade (1-10) for one grader from measured or estimated ratios. */
export function centeringGradeFor(
  ratios: CenteringRatios,
  grader: GraderCenteringKey
): { score: number | null; measured: boolean } {
  const { front, back, defaultFloor } = TABLES[grader];
  const sides: number[] = [];
  const fs = sideScore(ratios.frontLR, ratios.frontTB, front, defaultFloor);
  const bs = sideScore(ratios.backLR, ratios.backTB, back, defaultFloor);
  if (fs != null) sides.push(fs);
  if (bs != null) sides.push(bs);
  return {
    score: sides.length ? Math.min(...sides) : null,
    measured: ratios.measured === true,
  };
}

/** Human-readable cap note for a measured ratio (e.g. "Front 62/38 caps PSA 9"). */
export function centeringCapLabel(
  ratios: CenteringRatios,
  grader: GraderCenteringKey
): string | null {
  const { score } = centeringGradeFor(ratios, grader);
  if (score == null) return null;
  const worst = worstRatioLabel(ratios);
  return worst ? `${worst} → centering subgrade ~${score}/10 (${grader})` : null;
}

function worstRatioLabel(ratios: CenteringRatios): string | null {
  let worst: { pct: number; label: string } | null = null;
  const consider = (r: string | undefined, label: string) => {
    if (!r) return;
    const p = largerPct(r);
    if (p == null) return;
    if (!worst || p > worst.pct) worst = { pct: p, label: `${label} ${r}` };
  };
  consider(ratios.frontLR, "Front L/R");
  consider(ratios.frontTB, "Front T/B");
  consider(ratios.backLR, "Back L/R");
  consider(ratios.backTB, "Back T/B");
  return worst?.label ?? null;
}
