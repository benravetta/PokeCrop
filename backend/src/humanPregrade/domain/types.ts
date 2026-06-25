export type HumanPregradeStatus =
  | "draft"
  | "awaiting_payment"
  | "paid"
  | "awaiting_submission"
  | "submitted"
  | "queued"
  | "assigned"
  | "under_review"
  | "awaiting_customer_images"
  | "customer_images_received"
  | "report_drafting"
  | "quality_check"
  | "completed"
  | "unable_to_assess"
  | "cancelled"
  | "refunded";

export type AssessmentStatus = "draft" | "submitted" | "returned" | "approved" | "superseded";
export type ReportStatus = "draft" | "published" | "superseded" | "withdrawn";
export type ImageSourceType = "existing_upload" | "human_pregrade_upload";
export type ActorType = "customer" | "reviewer" | "qa" | "admin" | "system";

export type HumanPregradeErrorCode =
  | "HUMAN_PREGRADE_DISABLED"
  | "HUMAN_PREGRADE_NOT_FOUND"
  | "HUMAN_PREGRADE_FORBIDDEN"
  | "HUMAN_PREGRADE_INVALID_STATUS"
  | "HUMAN_PREGRADE_PAYMENT_REQUIRED"
  | "HUMAN_PREGRADE_IMAGES_REQUIRED"
  | "HUMAN_PREGRADE_INVALID_IMAGE"
  | "HUMAN_PREGRADE_INVALID_INPUT"
  | "HUMAN_PREGRADE_ALREADY_ASSIGNED"
  | "HUMAN_PREGRADE_ASSESSMENT_INCOMPLETE"
  | "HUMAN_PREGRADE_PROBABILITIES_INVALID"
  | "HUMAN_PREGRADE_REPORT_NOT_PUBLISHED"
  | "HUMAN_PREGRADE_REFUND_FAILED";

export interface HumanPregradeSettings {
  enabled: boolean;
  product_name: string;
  product_description: string;
  price_minor_units: number;
  currency: string;
  expected_turnaround_hours: number;
  queue_capacity: number;
  quality_check_required: boolean;
  reviewer_self_assignment_enabled: boolean;
  declared_value_qa_threshold_minor_units: number | null;
  mandatory_image_types: string[];
  max_image_bytes: number;
  max_video_bytes: number;
  supported_card_games: string[];
  customer_disclaimer: string;
  terms_version: string;
  disclaimer_version: string;
  training_consent_wording: string;
  report_query_period_days: number;
  notification_templates: Record<string, unknown>;
}

export interface HumanPregradeOrderRow {
  id: string;
  public_id: string;
  user_id: string;
  status: HumanPregradeStatus;
  version: number;
  payment_reference: string | null;
  currency: string;
  price_minor_units: number;
  service_name_snapshot: string;
  service_version: string;
  source_card_id: number | null;
  source_ai_report_id: number | null;
  ai_report_snapshot: Record<string, unknown> | null;
  primary_grader_id: string | null;
  card_game: string | null;
  card_name: string | null;
  set_name: string | null;
  card_number: string | null;
  release_year: number | null;
  language: string | null;
  variant: string | null;
  finish_type: string | null;
  declared_value_minor_units: number | null;
  declared_value_currency: string | null;
  previously_graded: boolean;
  previous_grader: string | null;
  previous_grade: string | null;
  known_damage: string | null;
  known_alteration: string | null;
  customer_notes: string | null;
  main_concern: string | null;
  submission_recommendation_requested: boolean;
  training_consent: boolean;
  terms_version: string;
  disclaimer_version: string;
  estimated_completion_at: string | null;
  submitted_at: string | null;
  assigned_at: string | null;
  review_started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  refunded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransitionContext {
  actorType: ActorType;
  actorId: string | null;
  reasonCode?: string | null;
  reasonText?: string | null;
  internalNote?: string | null;
  customerVisibleNote?: string | null;
  notificationRequired?: boolean;
  requestId?: string | null;
  ipAddress?: string | null;
}

export class HumanPregradeError extends Error {
  constructor(
    public readonly code: HumanPregradeErrorCode,
    message: string,
    public readonly status = 400
  ) {
    super(message);
    this.name = "HumanPregradeError";
  }
}
