import type { NavigateFunction } from "react-router-dom";
import { fetchCollectorGradePrefill } from "../api";
import type { GradePrefillPayload } from "../../hooks/useProcessing";

export async function sendCollectorCardToGrade(opts: {
  publicCardId: string;
  setGradePrefill: (payload: GradePrefillPayload) => void;
  navigate: NavigateFunction;
}): Promise<void> {
  const prefill = await fetchCollectorGradePrefill(opts.publicCardId);
  opts.setGradePrefill({
    front: { pngBase64: prefill.front.base64, filename: prefill.front.filename },
    back: prefill.back
      ? { pngBase64: prefill.back.base64, filename: prefill.back.filename }
      : undefined,
  });
  opts.navigate("/grade");
}
