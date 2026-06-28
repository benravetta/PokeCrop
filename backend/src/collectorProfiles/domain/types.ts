import { randomBytes } from "node:crypto";

export type CollectorProfileVisibility = "public" | "unlisted" | "private";
export type CollectorProfileStatus = "draft" | "active" | "hidden" | "suspended" | "deleted";
export type CollectorProfileAppearance = "light" | "dark";

export type CollectorProfileErrorCode =
  | "COLLECTOR_DISABLED"
  | "COLLECTOR_NOT_FOUND"
  | "COLLECTOR_FORBIDDEN"
  | "COLLECTOR_INVALID_INPUT"
  | "COLLECTOR_USERNAME_TAKEN"
  | "COLLECTOR_USERNAME_COOLDOWN"
  | "COLLECTOR_PROFILE_EXISTS"
  | "COLLECTOR_CARD_NOT_FOUND"
  | "COLLECTOR_BLOCKED"
  | "COLLECTOR_RATE_LIMIT"
  | "COLLECTOR_STORAGE_UNAVAILABLE"
  | "COLLECTOR_CROP_FAILED"
  | "COLLECTOR_GRADING_UNAVAILABLE"
  | "COLLECTOR_PAYMENT_REQUIRED";

export class CollectorProfileError extends Error {
  constructor(
    public code: CollectorProfileErrorCode,
    message: string,
    public status: number = 400
  ) {
    super(message);
    this.name = "CollectorProfileError";
  }
}

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
  report_reasons: unknown[];
  message_retention_days: number;
  require_admin_access_reason: boolean;
  notification_templates: Record<string, unknown>;
}

export interface CollectorProfileRow {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  bio: string | null;
  profile_image_storage_id: string | null;
  cover_image_storage_id: string | null;
  location_region: string | null;
  country_code: string | null;
  accent_setting: string | null;
  appearance_setting: CollectorProfileAppearance;
  visibility: CollectorProfileVisibility;
  search_visible: boolean;
  search_engine_indexing: boolean;
  trade_enquiries_enabled: boolean;
  messaging_enabled: boolean;
  allow_viewer_grading: boolean;
  featured_card_id: string | null;
  status: CollectorProfileStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CollectorProfileInterestRow {
  id: string;
  profile_id: string;
  interest_type: string;
  interest_value: string;
  display_order: number;
}

export interface CollectorProfileLinkRow {
  id: string;
  profile_id: string;
  platform: string;
  label: string;
  url: string;
  display_order: number;
  is_visible: boolean;
}

export interface CollectorProfileSectionOrderRow {
  profile_id: string;
  section: string;
  display_order: number;
  enabled: boolean;
}

export function generatePublicId(prefix = ""): string {
  const id = randomBytes(12).toString("base64url");
  return prefix ? `${prefix}_${id}` : id;
}

export const DEFAULT_SECTION_ORDER: { section: string; display_order: number; enabled: boolean }[] =
  [
    { section: "showcase", display_order: 0, enabled: true },
    { section: "for_trade", display_order: 1, enabled: true },
    { section: "wanted", display_order: 2, enabled: true },
    { section: "about", display_order: 3, enabled: true },
    { section: "links", display_order: 4, enabled: true },
  ];

export const REPORT_REASON_CODES = [
  "spam",
  "harassment",
  "abusive_language",
  "suspected_scam",
  "counterfeit_card",
  "misleading_condition",
  "stolen_images",
  "impersonation",
  "prohibited_item",
  "inappropriate_content",
  "personal_information",
  "underage_safety",
  "off_platform_payment_pressure",
  "other",
] as const;
