import { centeringGradeFor, type GraderCenteringKey } from "./centeringRules.js";

export interface MeasuredCentringFront {
  leftRight?: string;
  topBottom?: string;
}

export interface CentringPayload {
  measured: boolean;
  front?: MeasuredCentringFront;
  scores?: Partial<Record<GraderCenteringKey, number | null>>;
}

export function buildCentringPayload(front: MeasuredCentringFront | undefined): CentringPayload | null {
  if (!front?.leftRight && !front?.topBottom) return null;
  const ratios = {
    frontLR: front.leftRight?.trim() || undefined,
    frontTB: front.topBottom?.trim() || undefined,
    measured: true as const,
  };
  const graders: GraderCenteringKey[] = ["PSA", "Beckett", "CGC", "TAG", "ACE"];
  const scores: Partial<Record<GraderCenteringKey, number | null>> = {};
  for (const g of graders) {
    scores[g] = centeringGradeFor(ratios, g).score;
  }
  return { measured: true, front, scores };
}
