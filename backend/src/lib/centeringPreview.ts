import { analyzeCentering } from "./centeringEngine.js";
import type { MeasuredCentering } from "./grading.js";
import { measuredToMeta, measuredToRatios } from "./centeringInput.js";
import type { GraderKey } from "./gradingCriteria/index.js";

export interface CenteringPreviewHint {
  grader: GraderKey;
  centering_equivalent: number | null;
  grade_cap: "hard" | "soft" | "none";
  grade_cap_value: number | null;
  label: string | null;
}

export interface CenteringPreviewResult {
  explanation: string;
  measurement_confidence: number;
  grade_cap: "hard" | "soft" | "none";
  grade_cap_value: number | null;
  raw_centering_quality: number;
  hints: CenteringPreviewHint[];
}

const GRADERS: GraderKey[] = ["PSA", "BGS", "ACE", "CGC", "TAG"];

function hintLabel(grader: GraderKey, eq: number | null, cap: number | null): string | null {
  if (eq == null) return null;
  if (grader === "CGC") return `CGC centring ~${eq}/10 equivalent`;
  if (grader === "TAG") return `TAG centring ~${eq}/10 equivalent`;
  if (cap != null && cap < eq) return `${grader} centring cap ~${cap}`;
  return `${grader} centring ~${eq}/10 equivalent`;
}

/** Collector-safe centering preview — no LLM, no quota burn. */
export function previewCentering(c: MeasuredCentering): CenteringPreviewResult {
  const ratios = measuredToRatios(c);
  const meta = measuredToMeta(c);
  const analysis = analyzeCentering(ratios, meta, "PSA");

  const hints: CenteringPreviewHint[] = GRADERS.map((grader) => {
    const gr = analysis.grader_results[grader];
    const eq = gr?.centering_equivalent ?? null;
    const capVal = gr?.grade_cap_value ?? null;
    return {
      grader,
      centering_equivalent: eq,
      grade_cap: gr?.grade_cap ?? "none",
      grade_cap_value: capVal,
      label: hintLabel(grader, eq, capVal),
    };
  });

  return {
    explanation: analysis.explanation,
    measurement_confidence: analysis.measurement_confidence,
    grade_cap: analysis.grade_cap,
    grade_cap_value: analysis.grade_cap_value,
    raw_centering_quality: analysis.raw_centering_quality,
    hints,
  };
}
