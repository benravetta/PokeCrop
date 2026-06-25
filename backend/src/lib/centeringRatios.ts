// Shared centering ratio parsing — no engine dependency.

export interface CenteringRatios {
  frontLR?: string;
  frontTB?: string;
  backLR?: string;
  backTB?: string;
  measured?: boolean;
}

export function largerPct(ratio: string): number | null {
  const m = /^(\d{1,3})\s*\/\s*(\d{1,3})$/.exec(ratio.trim());
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a + b <= 0) return null;
  return Math.round((Math.max(a, b) / (a + b)) * 100);
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
