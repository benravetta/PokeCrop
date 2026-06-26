import { getServiceClient } from "./supabase.js";
import { syncSupabaseSignupGate } from "./supabaseManagement.js";

const CACHE_MS = 5_000;
let cache: { at: number; inviteRequired: boolean } | null = null;

/** Whether new signups require an invite. DB setting with env fallback. */
export async function isInviteRequired(opts?: { fresh?: boolean }): Promise<boolean> {
  const hit = cache;
  if (!opts?.fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.inviteRequired;

  try {
    const { data, error } = await getServiceClient()
      .from("app_settings")
      .select("invite_required")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    if (data && typeof data.invite_required === "boolean") {
      cache = { at: Date.now(), inviteRequired: data.invite_required };
      return data.invite_required;
    }
  } catch (err) {
    console.error("isInviteRequired DB read failed:", err);
    if (cache) return cache.inviteRequired;
    return true;
  }

  const fallback = isBetaInviteRequiredFromEnv();
  cache = { at: Date.now(), inviteRequired: fallback };
  return fallback;
}

export async function setInviteRequired(required: boolean): Promise<boolean> {
  const { error } = await getServiceClient()
    .from("app_settings")
    .upsert(
      { id: 1, invite_required: required, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );
  if (error) throw error;
  cache = { at: Date.now(), inviteRequired: required };
  return required;
}

export type InviteRequiredPolicyResult = {
  inviteRequired: boolean;
  supabaseSignupSynced: boolean;
};

/** Persist invite policy in DB and mirror disable_signup to Supabase when configured. */
export async function setInviteRequiredPolicy(
  required: boolean
): Promise<InviteRequiredPolicyResult> {
  const previous = await isInviteRequired({ fresh: true });
  await setInviteRequired(required);

  try {
    const supabaseSignupSynced = await syncSupabaseSignupGate(required);
    return { inviteRequired: required, supabaseSignupSynced };
  } catch (err) {
    await setInviteRequired(previous).catch((revertErr) =>
      console.error("setInviteRequiredPolicy revert failed:", revertErr)
    );
    throw err;
  }
}

export function clearAppSettingsCache(): void {
  cache = null;
}

/** @deprecated Use isInviteRequired() — kept for tests syncing env-only fallback. */
export function isBetaInviteRequiredFromEnv(): boolean {
  return process.env.BETA_INVITE_REQUIRED === "true";
}
