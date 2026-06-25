import { getServiceClient } from "../../lib/supabase.js";
import type { HumanPregradeSettings } from "../domain/types.js";
import { isHumanPregradeEnvEnabled } from "../domain/featureFlag.js";

const SETTINGS_PATCH_KEYS: (keyof HumanPregradeSettings)[] = [
  "enabled",
  "product_name",
  "product_description",
  "price_minor_units",
  "currency",
  "expected_turnaround_hours",
  "queue_capacity",
  "quality_check_required",
  "reviewer_self_assignment_enabled",
  "declared_value_qa_threshold_minor_units",
  "mandatory_image_types",
  "max_image_bytes",
  "max_video_bytes",
  "supported_card_games",
  "customer_disclaimer",
  "terms_version",
  "disclaimer_version",
  "training_consent_wording",
  "report_query_period_days",
  "notification_templates",
];

function pickSettingsPatch(raw: Record<string, unknown>): Partial<HumanPregradeSettings> {
  const out: Partial<HumanPregradeSettings> = {};
  for (const k of SETTINGS_PATCH_KEYS) {
    if (raw[k] !== undefined) (out as Record<string, unknown>)[k] = raw[k];
  }
  return out;
}

export async function getHumanPregradeSettings(): Promise<HumanPregradeSettings> {
  const { data, error } = await getServiceClient()
    .from("human_pregrade_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  const row = data ?? {};
  return {
    enabled: Boolean(row.enabled),
    product_name: String(row.product_name ?? "GemCheck Expert Review"),
    product_description: String(row.product_description ?? ""),
    price_minor_units: Number(row.price_minor_units ?? 4999),
    currency: String(row.currency ?? "GBP"),
    expected_turnaround_hours: Number(row.expected_turnaround_hours ?? 72),
    queue_capacity: Number(row.queue_capacity ?? 100),
    quality_check_required: Boolean(row.quality_check_required ?? true),
    reviewer_self_assignment_enabled: Boolean(row.reviewer_self_assignment_enabled ?? false),
    declared_value_qa_threshold_minor_units:
      row.declared_value_qa_threshold_minor_units == null
        ? null
        : Number(row.declared_value_qa_threshold_minor_units),
    mandatory_image_types: Array.isArray(row.mandatory_image_types)
      ? row.mandatory_image_types.map(String)
      : ["front", "back"],
    max_image_bytes: Number(row.max_image_bytes ?? 15_728_640),
    max_video_bytes: Number(row.max_video_bytes ?? 52_428_800),
    supported_card_games: Array.isArray(row.supported_card_games)
      ? row.supported_card_games.map(String)
      : ["Pokemon"],
    customer_disclaimer: String(row.customer_disclaimer ?? ""),
    terms_version: String(row.terms_version ?? "1.0"),
    disclaimer_version: String(row.disclaimer_version ?? "1.0"),
    training_consent_wording: String(row.training_consent_wording ?? ""),
    report_query_period_days: Number(row.report_query_period_days ?? 14),
    notification_templates:
      row.notification_templates && typeof row.notification_templates === "object"
        ? (row.notification_templates as Record<string, unknown>)
        : {},
  };
}

export async function isHumanPregradeFeatureEnabled(): Promise<boolean> {
  if (!isHumanPregradeEnvEnabled()) return false;
  const settings = await getHumanPregradeSettings();
  return settings.enabled;
}

export async function updateHumanPregradeSettings(
  patch: Partial<HumanPregradeSettings> | Record<string, unknown>
): Promise<HumanPregradeSettings> {
  const safe = pickSettingsPatch(patch as Record<string, unknown>);
  const { error } = await getServiceClient()
    .from("human_pregrade_settings")
    .update({ ...safe, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw error;
  return getHumanPregradeSettings();
}
