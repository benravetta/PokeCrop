import type { Plan } from "./plans";

export function shouldWatermarkFreeExports(opts: {
  isAdmin?: boolean;
  plan?: Plan | null;
  billing?: string | null;
}): boolean {
  if (opts.isAdmin) return false;
  if (opts.billing && opts.billing !== "free") return false;
  if (opts.plan && opts.plan !== "free") return false;
  return true;
}
