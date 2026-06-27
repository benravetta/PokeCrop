import { getServiceClient } from "../../lib/supabase.js";
import {
  CollectorProfileError,
  DEFAULT_SECTION_ORDER,
  type CollectorProfileInterestRow,
  type CollectorProfileLinkRow,
  type CollectorProfileRow,
  type CollectorProfileSectionOrderRow,
} from "../domain/types.js";
import { normalizeUsername, validateUsername } from "../domain/username.js";
import { usernameRedirectDaysFromEnv } from "../domain/featureFlag.js";

export async function getProfileByUserId(userId: string): Promise<CollectorProfileRow | null> {
  const { data, error } = await getServiceClient()
    .from("collector_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as CollectorProfileRow | null;
}

export async function getProfileByUsername(username: string): Promise<CollectorProfileRow | null> {
  const normalized = normalizeUsername(username);
  const { data, error } = await getServiceClient()
    .from("collector_profiles")
    .select("*")
    .eq("username", normalized)
    .maybeSingle();
  if (error) throw error;
  return data as CollectorProfileRow | null;
}

export async function getProfileById(id: string): Promise<CollectorProfileRow | null> {
  const { data, error } = await getServiceClient()
    .from("collector_profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as CollectorProfileRow | null;
}

export async function resolveUsernameRedirect(
  username: string
): Promise<{ profile: CollectorProfileRow; redirectedFrom: string } | null> {
  const direct = await getProfileByUsername(username);
  if (direct) return { profile: direct, redirectedFrom: "" };

  const normalized = normalizeUsername(username);
  const { data, error } = await getServiceClient()
    .from("collector_profile_username_history")
    .select("*, collector_profiles(*)")
    .eq("previous_username", normalized)
    .gt("redirect_expires_at", new Date().toISOString())
    .order("changed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.collector_profiles) return null;
  return {
    profile: data.collector_profiles as CollectorProfileRow,
    redirectedFrom: normalized,
  };
}

export async function isUsernameAvailable(username: string, excludeProfileId?: string): Promise<boolean> {
  const v = validateUsername(username);
  if (!v.ok) return false;
  const { data, error } = await getServiceClient()
    .from("collector_profiles")
    .select("id")
    .eq("username", v.username)
    .maybeSingle();
  if (error) throw error;
  if (!data) return true;
  return excludeProfileId ? data.id === excludeProfileId : false;
}

export async function createProfile(opts: {
  userId: string;
  username: string;
  displayName: string;
  allowViewerGradingDefault: boolean;
}): Promise<CollectorProfileRow> {
  const v = validateUsername(opts.username);
  if (!v.ok) {
    throw new CollectorProfileError("COLLECTOR_INVALID_INPUT", v.message, 400);
  }
  if (!(await isUsernameAvailable(v.username))) {
    throw new CollectorProfileError("COLLECTOR_USERNAME_TAKEN", "That username is already taken.", 409);
  }

  const existing = await getProfileByUserId(opts.userId);
  if (existing) {
    throw new CollectorProfileError(
      "COLLECTOR_PROFILE_EXISTS",
      "You already have a collector profile.",
      409
    );
  }

  const { data, error } = await getServiceClient()
    .from("collector_profiles")
    .insert({
      user_id: opts.userId,
      username: v.username,
      display_name: opts.displayName.trim().slice(0, 80) || v.username,
      allow_viewer_grading: opts.allowViewerGradingDefault,
      visibility: "private",
      status: "draft",
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") {
      throw new CollectorProfileError("COLLECTOR_USERNAME_TAKEN", "That username is already taken.", 409);
    }
    throw error;
  }

  const profile = data as CollectorProfileRow;
  await getServiceClient().from("collector_profile_section_order").insert(
    DEFAULT_SECTION_ORDER.map((s) => ({ profile_id: profile.id, ...s }))
  );
  return profile;
}

export async function updateProfile(
  profileId: string,
  patch: Record<string, unknown>
): Promise<CollectorProfileRow> {
  const allowed = [
    "display_name",
    "bio",
    "profile_image_storage_id",
    "cover_image_storage_id",
    "location_region",
    "country_code",
    "accent_setting",
    "appearance_setting",
    "visibility",
    "search_visible",
    "search_engine_indexing",
    "trade_enquiries_enabled",
    "messaging_enabled",
    "allow_viewer_grading",
    "featured_card_id",
  ];
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of allowed) {
    if (patch[k] !== undefined) update[k] = patch[k];
  }
  const { data, error } = await getServiceClient()
    .from("collector_profiles")
    .update(update)
    .eq("id", profileId)
    .select("*")
    .single();
  if (error) throw error;
  return data as CollectorProfileRow;
}

export async function changeUsername(
  profile: CollectorProfileRow,
  newUsernameRaw: string,
  cooldownDays: number
): Promise<CollectorProfileRow> {
  const v = validateUsername(newUsernameRaw);
  if (!v.ok) {
    throw new CollectorProfileError("COLLECTOR_INVALID_INPUT", v.message, 400);
  }
  if (v.username === profile.username) return profile;
  if (!(await isUsernameAvailable(v.username, profile.id))) {
    throw new CollectorProfileError("COLLECTOR_USERNAME_TAKEN", "That username is already taken.", 409);
  }

  const { data: lastChange } = await getServiceClient()
    .from("collector_profile_username_history")
    .select("changed_at")
    .eq("profile_id", profile.id)
    .order("changed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastChange?.changed_at) {
    const elapsed = Date.now() - new Date(lastChange.changed_at).getTime();
    const cooldownMs = cooldownDays * 86400000;
    if (elapsed < cooldownMs) {
      throw new CollectorProfileError(
        "COLLECTOR_USERNAME_COOLDOWN",
        `You can change your username again in ${Math.ceil((cooldownMs - elapsed) / 86400000)} days.`,
        409
      );
    }
  }

  const redirectDays = usernameRedirectDaysFromEnv();
  const redirectExpires = new Date(Date.now() + redirectDays * 86400000).toISOString();

  await getServiceClient().from("collector_profile_username_history").insert({
    profile_id: profile.id,
    previous_username: profile.username,
    new_username: v.username,
    redirect_expires_at: redirectExpires,
  });

  const { data, error } = await getServiceClient()
    .from("collector_profiles")
    .update({ username: v.username, updated_at: new Date().toISOString() })
    .eq("id", profile.id)
    .select("*")
    .single();
  if (error) throw error;
  return data as CollectorProfileRow;
}

export async function publishProfile(profileId: string): Promise<CollectorProfileRow> {
  const { data, error } = await getServiceClient()
    .from("collector_profiles")
    .update({
      status: "active",
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", profileId)
    .select("*")
    .single();
  if (error) throw error;
  return data as CollectorProfileRow;
}

export async function unpublishProfile(profileId: string): Promise<CollectorProfileRow> {
  const { data, error } = await getServiceClient()
    .from("collector_profiles")
    .update({
      status: "hidden",
      updated_at: new Date().toISOString(),
    })
    .eq("id", profileId)
    .select("*")
    .single();
  if (error) throw error;
  return data as CollectorProfileRow;
}

export async function listProfileInterests(profileId: string): Promise<CollectorProfileInterestRow[]> {
  const { data, error } = await getServiceClient()
    .from("collector_profile_interests")
    .select("*")
    .eq("profile_id", profileId)
    .order("display_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CollectorProfileInterestRow[];
}

export async function replaceProfileInterests(
  profileId: string,
  interests: { interest_type: string; interest_value: string; display_order: number }[]
): Promise<void> {
  await getServiceClient().from("collector_profile_interests").delete().eq("profile_id", profileId);
  if (interests.length === 0) return;
  const { error } = await getServiceClient().from("collector_profile_interests").insert(
    interests.map((i) => ({ profile_id: profileId, ...i }))
  );
  if (error) throw error;
}

export async function listProfileLinks(profileId: string): Promise<CollectorProfileLinkRow[]> {
  const { data, error } = await getServiceClient()
    .from("collector_profile_links")
    .select("*")
    .eq("profile_id", profileId)
    .order("display_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CollectorProfileLinkRow[];
}

export async function replaceProfileLinks(
  profileId: string,
  links: { platform: string; label: string; url: string; display_order: number; is_visible: boolean }[]
): Promise<void> {
  await getServiceClient().from("collector_profile_links").delete().eq("profile_id", profileId);
  if (links.length === 0) return;
  const { error } = await getServiceClient().from("collector_profile_links").insert(
    links.map((l) => ({ profile_id: profileId, ...l }))
  );
  if (error) throw error;
}

export async function getSectionOrder(profileId: string): Promise<CollectorProfileSectionOrderRow[]> {
  const { data, error } = await getServiceClient()
    .from("collector_profile_section_order")
    .select("*")
    .eq("profile_id", profileId)
    .order("display_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CollectorProfileSectionOrderRow[];
}

export async function replaceSectionOrder(
  profileId: string,
  sections: { section: string; display_order: number; enabled: boolean }[]
): Promise<void> {
  await getServiceClient().from("collector_profile_section_order").delete().eq("profile_id", profileId);
  if (sections.length === 0) return;
  const { error } = await getServiceClient().from("collector_profile_section_order").insert(
    sections.map((s) => ({ profile_id: profileId, ...s }))
  );
  if (error) throw error;
}

export async function listProfilesAdmin(opts: {
  limit?: number;
  status?: string;
}): Promise<CollectorProfileRow[]> {
  let q = getServiceClient().from("collector_profiles").select("*").order("created_at", { ascending: false });
  if (opts.status) q = q.eq("status", opts.status);
  q = q.limit(opts.limit ?? 200);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as CollectorProfileRow[];
}

export async function setProfileStatus(
  profileId: string,
  status: string
): Promise<CollectorProfileRow> {
  const { data, error } = await getServiceClient()
    .from("collector_profiles")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", profileId)
    .select("*")
    .single();
  if (error) throw error;
  return data as CollectorProfileRow;
}
