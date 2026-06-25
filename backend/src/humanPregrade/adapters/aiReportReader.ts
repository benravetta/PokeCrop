import { getServiceClient } from "../../lib/supabase.js";

export interface AIReportSummary {
  usageEventId: number;
  cardName?: string;
  setName?: string;
  cardNumber?: string;
  verdict?: string;
  likely?: string;
  snapshot?: Record<string, unknown> | null;
}

export async function readAIReportForUser(
  userId: string,
  usageEventId: number
): Promise<AIReportSummary | null> {
  const { data, error } = await getServiceClient()
    .from("usage_events")
    .select("id, kind, user_id, detail")
    .eq("id", usageEventId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.kind !== "grade") return null;
  const d = (data.detail ?? {}) as Record<string, unknown>;
  return {
    usageEventId: data.id,
    cardName: typeof d.name === "string" ? d.name : undefined,
    setName: typeof d.set === "string" ? d.set : undefined,
    cardNumber: typeof d.number === "string" ? d.number : undefined,
    verdict: typeof d.verdict === "string" ? d.verdict : undefined,
    likely: typeof d.likely === "string" ? d.likely : undefined,
  };
}

export function validateAISnapshot(snapshot: unknown): Record<string, unknown> | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  return snapshot as Record<string, unknown>;
}
