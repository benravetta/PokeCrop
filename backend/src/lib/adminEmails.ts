import { getServiceClient } from "./supabase.js";

/** Resolve emails for many user ids in one round-trip (service-role RPC). */
export async function emailByUserIds(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return map;

  const { data, error } = await getServiceClient().rpc("admin_user_emails", {
    p_ids: unique,
  });
  if (error) throw error;

  for (const row of data ?? []) {
    const userId = row.user_id as string;
    const email = row.email as string | null;
    if (userId && email) map.set(userId, email);
  }
  return map;
}
