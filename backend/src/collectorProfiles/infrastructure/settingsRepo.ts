import { getServiceClient } from "../../lib/supabase.js";
import type { CollectorProfileSettings } from "../domain/types.js";
import { isCollectorProfilesEnvEnabled } from "../domain/featureFlag.js";

const SETTINGS_KEYS: (keyof CollectorProfileSettings)[] = [
  "collector_profiles_enabled",
  "collector_profile_messaging_enabled",
  "collector_profile_grading_enabled",
  "collector_profile_discovery_enabled",
  "collector_profile_trade_enquiries_enabled",
  "username_change_interval_days",
  "username_redirect_days",
  "max_cards_per_profile",
  "max_wanted_entries",
  "max_trade_enquiries_per_day",
  "max_messages_per_minute",
  "max_new_conversations_per_hour",
  "max_profile_image_bytes",
  "max_card_image_bytes",
  "max_message_attachment_bytes",
  "allow_viewer_grading_default",
  "supported_card_games",
  "external_link_policy",
  "report_reasons",
  "message_retention_days",
  "require_admin_access_reason",
  "notification_templates",
];

function mapSettingsRow(row: Record<string, unknown>): CollectorProfileSettings {
  return {
    collector_profiles_enabled: Boolean(row.collector_profiles_enabled),
    collector_profile_messaging_enabled: Boolean(row.collector_profile_messaging_enabled),
    collector_profile_grading_enabled: Boolean(row.collector_profile_grading_enabled),
    collector_profile_discovery_enabled: Boolean(row.collector_profile_discovery_enabled),
    collector_profile_trade_enquiries_enabled: Boolean(
      row.collector_profile_trade_enquiries_enabled
    ),
    username_change_interval_days: Number(row.username_change_interval_days ?? 30),
    username_redirect_days: Number(row.username_redirect_days ?? 90),
    max_cards_per_profile: Number(row.max_cards_per_profile ?? 500),
    max_wanted_entries: Number(row.max_wanted_entries ?? 200),
    max_trade_enquiries_per_day: Number(row.max_trade_enquiries_per_day ?? 20),
    max_messages_per_minute: Number(row.max_messages_per_minute ?? 30),
    max_new_conversations_per_hour: Number(row.max_new_conversations_per_hour ?? 10),
    max_profile_image_bytes: Number(row.max_profile_image_bytes ?? 5_242_880),
    max_card_image_bytes: Number(row.max_card_image_bytes ?? 15_728_640),
    max_message_attachment_bytes: Number(row.max_message_attachment_bytes ?? 5_242_880),
    allow_viewer_grading_default: Boolean(row.allow_viewer_grading_default ?? true),
    supported_card_games: Array.isArray(row.supported_card_games)
      ? row.supported_card_games.map(String)
      : ["Pokemon"],
    external_link_policy: String(row.external_link_policy ?? "warn"),
    report_reasons: Array.isArray(row.report_reasons) ? row.report_reasons : [],
    message_retention_days: Number(row.message_retention_days ?? 365),
    require_admin_access_reason: Boolean(row.require_admin_access_reason ?? true),
    notification_templates:
      row.notification_templates && typeof row.notification_templates === "object"
        ? (row.notification_templates as Record<string, unknown>)
        : {},
  };
}

export async function getCollectorProfileSettings(): Promise<CollectorProfileSettings> {
  const { data, error } = await getServiceClient()
    .from("collector_profile_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  return mapSettingsRow(data ?? {});
}

export async function isCollectorProfilesFeatureEnabled(): Promise<boolean> {
  if (!isCollectorProfilesEnvEnabled()) return false;
  const settings = await getCollectorProfileSettings();
  return settings.collector_profiles_enabled;
}

export async function updateCollectorProfileSettings(
  patch: Partial<CollectorProfileSettings>
): Promise<CollectorProfileSettings> {
  const allowed: Record<string, unknown> = {};
  for (const k of SETTINGS_KEYS) {
    if (patch[k] !== undefined) allowed[k] = patch[k];
  }
  allowed.updated_at = new Date().toISOString();
  const { data, error } = await getServiceClient()
    .from("collector_profile_settings")
    .update(allowed)
    .eq("id", 1)
    .select("*")
    .single();
  if (error) throw error;
  return mapSettingsRow(data);
}

export async function getStaffPermissions(userId: string): Promise<string[]> {
  const { data } = await getServiceClient()
    .from("collector_profile_staff")
    .select("permissions")
    .eq("user_id", userId)
    .maybeSingle();
  return Array.isArray(data?.permissions) ? data.permissions.map(String) : [];
}
