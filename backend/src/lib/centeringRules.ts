// Thin compatibility wrapper — delegates grading to centeringEngine.

export { largerPct, ratiosFromFindings, type CenteringRatios } from "./centeringRatios.js";
import { largerPct as pct, type CenteringRatios } from "./centeringRatios.js";
import { centeringSubgradeFor, graderKeyFromLegacy } from "./centeringEngine.js";
import type { CenteringMeasurementMeta } from "./centeringEngine.js";

export type GraderCenteringKey = "PSA" | "Beckett" | "CGC" | "TAG" | "ACE";

/** Centering subgrade (1-10) for one grader from measured or estimated ratios. */
export function centeringGradeFor(
  ratios: CenteringRatios,
  grader: GraderCenteringKey,
  meta?: CenteringMeasurementMeta
): { score: number | null; measured: boolean } {
  const key = graderKeyFromLegacy(grader === "Beckett" ? "Beckett" : grader);
  const { score, measured } = centeringSubgradeFor(key, ratios, meta);
  return { score, measured };
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
  let worstPct = -1;
  let worstLabel: string | null = null;
  const consider = (r: string | undefined, label: string) => {
    if (!r) return;
    const p = pct(r);
    if (p == null) return;
    if (p > worstPct) {
      worstPct = p;
      worstLabel = `${label} ${r}`;
    }
  };
  consider(ratios.frontLR, "Front L/R");
  consider(ratios.frontTB, "Front T/B");
  consider(ratios.backLR, "Back L/R");
  consider(ratios.backTB, "Back T/B");
  return worstLabel;
}
