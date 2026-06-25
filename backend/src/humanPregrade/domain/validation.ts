export function validateProbabilityDistribution(
  distribution: Record<string, number>,
  gradeScale: string[],
  tolerance = 0.02
): boolean {
  const entries = Object.entries(distribution).filter(([, v]) => v > 0);
  if (!entries.length) return false;
  for (const [grade] of entries) {
    if (!gradeScale.includes(grade)) return false;
  }
  const sum = entries.reduce((a, [, v]) => a + v, 0);
  return Math.abs(sum - 1) <= tolerance && entries.every(([, v]) => v >= 0 && v <= 1);
}

export function validateAssessmentComplete(assessment: Record<string, unknown>): boolean {
  return Boolean(
    assessment.condition_summary &&
      assessment.image_sufficiency &&
      assessment.main_grade_limiter
  );
}
