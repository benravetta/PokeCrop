import { getServiceClient } from "./supabase.js";

export type IdempotencyClaim =
  | { action: "claimed" }
  | { action: "replay"; body: unknown }
  | { action: "wait"; retryAfter: number };

export async function claimGradeIdempotency(
  userId: string,
  key: string
): Promise<IdempotencyClaim> {
  const { data, error } = await getServiceClient().rpc("claim_api_grade_idempotency", {
    p_user: userId,
    p_key: key,
  });
  if (error) throw error;
  const row = data as Record<string, unknown> | null;
  if (!row || typeof row.action !== "string") return { action: "claimed" };
  if (row.action === "replay" && row.body != null) {
    return { action: "replay", body: row.body };
  }
  if (row.action === "wait") {
    return {
      action: "wait",
      retryAfter: typeof row.retry_after === "number" ? row.retry_after : 30,
    };
  }
  return { action: "claimed" };
}

export async function completeGradeIdempotency(
  userId: string,
  key: string,
  body: unknown
): Promise<void> {
  const { error } = await getServiceClient().rpc("complete_api_grade_idempotency", {
    p_user: userId,
    p_key: key,
    p_body: body,
  });
  if (error) throw error;
}

export async function releaseGradeIdempotency(userId: string, key: string): Promise<void> {
  const { error } = await getServiceClient().rpc("release_api_grade_idempotency", {
    p_user: userId,
    p_key: key,
  });
  if (error) throw error;
}
