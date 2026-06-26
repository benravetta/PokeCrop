import { analyzeCentering, centeringSubgradeFor } from "./centeringEngine.js";
import { parseCentering } from "./gradeService.js";
import type { GraderCenteringKey } from "./centeringRules.js";
import type { CenteringRatios } from "./centeringRatios.js";

export interface MeasuredCentringFront {
  leftRight?: string;
  topBottom?: string;
}

export interface CentringPayload {
  measured: boolean;
  front?: MeasuredCentringFront;
  scores?: Partial<Record<GraderCenteringKey, number | null>>;
  explanation?: string;
  raw_centering_quality?: number;
}

export function buildCentringPayload(front: MeasuredCentringFront | undefined): CentringPayload | null {
  const parsed = parseCentering({ front });
  if (!parsed?.front) return null;
  const safeFront = parsed.front;
  const ratios: CenteringRatios = {
    frontLR: safeFront.leftRight,
    frontTB: safeFront.topBottom,
    measured: true,
  };
  const analysis = analyzeCentering(ratios, { measured: true }, "PSA");
  const graders: GraderCenteringKey[] = ["PSA", "Beckett", "CGC", "TAG", "ACE"];
  const scores: Partial<Record<GraderCenteringKey, number | null>> = {};
  for (const g of graders) {
    const key = g === "Beckett" ? "BGS" : g;
    scores[g] = centeringSubgradeFor(key, ratios, { measured: true }).score;
  }
  return {
    measured: true,
    front: safeFront,
    scores,
    explanation: analysis.explanation,
    raw_centering_quality: analysis.raw_centering_quality,
  };
}
