import type { CropCentring } from "./api";

export function centringLabel(centring: CropCentring | null | undefined): string {
  const s = centring?.scores;
  if (!s) return "—";
  const psa = s.PSA;
  const beck = s.Beckett;
  if (psa != null && beck != null) return `PSA ${psa} · BGS ${beck}`;
  if (psa != null) return `PSA ${psa}`;
  if (beck != null) return `BGS ${beck}`;
  const front = centring?.front;
  if (front?.leftRight) return front.leftRight;
  return "—";
}

export function fmtCropDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
