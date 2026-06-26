/** Supabase Management API — project auth config (disable_signup). */

export function getSupabaseProjectRef(): string | null {
  const explicit = process.env.SUPABASE_PROJECT_REF?.trim();
  if (explicit) return explicit;

  const url = process.env.SUPABASE_URL?.trim();
  if (!url) return null;

  try {
    const ref = new URL(url).hostname.split(".")[0];
    return ref || null;
  } catch {
    return null;
  }
}

export function isSupabaseManagementConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_ACCESS_TOKEN?.trim() && getSupabaseProjectRef()
  );
}

/** When true, invite-only also sets Supabase disable_signup via Management API. */
export async function setSupabaseDisableSignup(disable: boolean): Promise<void> {
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  const ref = getSupabaseProjectRef();
  if (!token || !ref) {
    throw new Error(
      "Supabase Management API is not configured (SUPABASE_ACCESS_TOKEN and project ref)."
    );
  }

  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ disable_signup: disable }),
  });

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    throw new Error(
      `Supabase auth config update failed (${res.status})${detail ? `: ${detail}` : ""}`
    );
  }
}

/**
 * Mirror app invite-only policy to Supabase Auth.
 * inviteRequired=true → disable_signup=true (block direct Auth signups).
 */
export async function syncSupabaseSignupGate(inviteRequired: boolean): Promise<boolean> {
  if (!isSupabaseManagementConfigured()) return false;
  await setSupabaseDisableSignup(inviteRequired);
  return true;
}
