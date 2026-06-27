export interface CollectorProfileSettings {
  collector_profiles_enabled: boolean;
  collector_profile_messaging_enabled: boolean;
  collector_profile_grading_enabled: boolean;
  collector_profile_discovery_enabled: boolean;
  collector_profile_trade_enquiries_enabled: boolean;
  username_change_interval_days: number;
  username_redirect_days: number;
  max_cards_per_profile: number;
  max_wanted_entries: number;
  max_trade_enquiries_per_day: number;
  max_messages_per_minute: number;
  max_new_conversations_per_hour: number;
  max_profile_image_bytes: number;
  max_card_image_bytes: number;
  max_message_attachment_bytes: number;
  allow_viewer_grading_default: boolean;
  supported_card_games: string[];
  external_link_policy: string;
  report_reasons: string[];
  message_retention_days: number;
  require_admin_access_reason: boolean;
  notification_templates: Record<string, unknown>;
}

export interface CollectorSettingsResponse {
  settings: CollectorProfileSettings;
  envEnabled: boolean;
  effectiveEnabled: boolean;
}

export const DEFAULT_COLLECTOR_SETTINGS: CollectorProfileSettings = {
  collector_profiles_enabled: false,
  collector_profile_messaging_enabled: false,
  collector_profile_grading_enabled: false,
  collector_profile_discovery_enabled: false,
  collector_profile_trade_enquiries_enabled: false,
  username_change_interval_days: 30,
  username_redirect_days: 90,
  max_cards_per_profile: 500,
  max_wanted_entries: 200,
  max_trade_enquiries_per_day: 20,
  max_messages_per_minute: 30,
  max_new_conversations_per_hour: 10,
  max_profile_image_bytes: 5_242_880,
  max_card_image_bytes: 15_728_640,
  max_message_attachment_bytes: 5_242_880,
  allow_viewer_grading_default: true,
  supported_card_games: ["Pokemon"],
  external_link_policy: "warn",
  report_reasons: [],
  message_retention_days: 365,
  require_admin_access_reason: true,
  notification_templates: {},
};
