import { getServiceClient } from "../../lib/supabase.js";

export async function isBlocked(blockingUserId: string, blockedUserId: string): Promise<boolean> {
  const { data } = await getServiceClient()
    .from("collector_user_blocks")
    .select("id")
    .eq("blocking_user_id", blockingUserId)
    .eq("blocked_user_id", blockedUserId)
    .maybeSingle();
  return Boolean(data);
}

export async function isEitherBlocked(a: string, b: string): Promise<boolean> {
  if (await isBlocked(a, b)) return true;
  if (await isBlocked(b, a)) return true;
  return false;
}

export async function blockUser(opts: {
  blockingUserId: string;
  blockedUserId: string;
  reason?: string;
}): Promise<void> {
  await getServiceClient().from("collector_user_blocks").upsert(
    {
      blocking_user_id: opts.blockingUserId,
      blocked_user_id: opts.blockedUserId,
      reason: opts.reason ?? null,
    },
    { onConflict: "blocking_user_id,blocked_user_id" }
  );
}

export async function unblockUser(blockingUserId: string, blockedUserId: string): Promise<void> {
  await getServiceClient()
    .from("collector_user_blocks")
    .delete()
    .eq("blocking_user_id", blockingUserId)
    .eq("blocked_user_id", blockedUserId);
}

export async function listBlocks(userId: string) {
  const { data, error } = await getServiceClient()
    .from("collector_user_blocks")
    .select("*")
    .eq("blocking_user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
