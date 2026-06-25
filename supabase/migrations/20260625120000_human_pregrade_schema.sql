-- Human Expert Pre-Grade (GemCheck Expert Review) — additive schema only.

CREATE TABLE IF NOT EXISTS public.human_pregrade_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT false,
  product_name text NOT NULL DEFAULT 'GemCheck Expert Review',
  product_description text NOT NULL DEFAULT '',
  price_minor_units integer NOT NULL DEFAULT 4999,
  currency text NOT NULL DEFAULT 'GBP',
  expected_turnaround_hours integer NOT NULL DEFAULT 72,
  queue_capacity integer NOT NULL DEFAULT 100,
  quality_check_required boolean NOT NULL DEFAULT true,
  reviewer_self_assignment_enabled boolean NOT NULL DEFAULT false,
  declared_value_qa_threshold_minor_units integer,
  mandatory_image_types text[] NOT NULL DEFAULT ARRAY['front','back'],
  max_image_bytes bigint NOT NULL DEFAULT 15728640,
  max_video_bytes bigint NOT NULL DEFAULT 52428800,
  supported_card_games text[] NOT NULL DEFAULT ARRAY['Pokemon','Magic','Yu-Gi-Oh!'],
  customer_disclaimer text NOT NULL DEFAULT 'This report is an independent human pre-grading opinion based solely on the digital images supplied. It is not official grading, certification or authentication.',
  terms_version text NOT NULL DEFAULT '1.0',
  disclaimer_version text NOT NULL DEFAULT '1.0',
  training_consent_wording text NOT NULL DEFAULT 'I consent to anonymised use of my images for internal training.',
  report_query_period_days integer NOT NULL DEFAULT 14,
  notification_templates jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.human_pregrade_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.human_pregrade_graders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  grade_scale jsonb NOT NULL DEFAULT '[]'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.human_pregrade_graders (code, name, grade_scale, display_order) VALUES
  ('PSA', 'PSA', '["10","9","8","7","6","5","4","3","2","1"]'::jsonb, 1),
  ('ACE', 'ACE', '["10","9.5","9","8.5","8","7","6","5"]'::jsonb, 2),
  ('BGS', 'Beckett', '["10","9.5","9","8.5","8","7.5","7","6","5","4","3","2","1"]'::jsonb, 3),
  ('TAG', 'TAG', '["10","9","8","7","6","5"]'::jsonb, 4),
  ('CGC', 'CGC', '["10","9.5","9","8.5","8","7.5","7","6","5","4","3","2","1"]'::jsonb, 5)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.human_pregrade_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft',
  version integer NOT NULL DEFAULT 1,
  payment_reference text,
  currency text NOT NULL DEFAULT 'GBP',
  price_minor_units integer NOT NULL DEFAULT 0,
  service_name_snapshot text NOT NULL DEFAULT 'GemCheck Expert Review',
  service_version text NOT NULL DEFAULT '1.0',
  source_card_id bigint,
  source_ai_report_id bigint,
  ai_report_snapshot jsonb,
  primary_grader_id uuid REFERENCES public.human_pregrade_graders (id),
  card_game text,
  card_name text,
  set_name text,
  card_number text,
  release_year integer,
  language text,
  variant text,
  finish_type text,
  declared_value_minor_units integer,
  declared_value_currency text,
  previously_graded boolean NOT NULL DEFAULT false,
  previous_grader text,
  previous_grade text,
  known_damage text,
  known_alteration text,
  customer_notes text,
  main_concern text,
  submission_recommendation_requested boolean NOT NULL DEFAULT false,
  training_consent boolean NOT NULL DEFAULT false,
  terms_version text NOT NULL DEFAULT '1.0',
  disclaimer_version text NOT NULL DEFAULT '1.0',
  estimated_completion_at timestamptz,
  submitted_at timestamptz,
  assigned_at timestamptz,
  review_started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT human_pregrade_orders_status_check CHECK (
    status IN (
      'draft','awaiting_payment','paid','awaiting_submission','submitted','queued',
      'assigned','under_review','awaiting_customer_images','customer_images_received',
      'report_drafting','quality_check','completed','unable_to_assess','cancelled','refunded'
    )
  )
);

CREATE INDEX IF NOT EXISTS human_pregrade_orders_user_idx ON public.human_pregrade_orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS human_pregrade_orders_status_idx ON public.human_pregrade_orders (status, submitted_at DESC);

CREATE TABLE IF NOT EXISTS public.human_pregrade_order_graders (
  order_id uuid NOT NULL REFERENCES public.human_pregrade_orders (id) ON DELETE CASCADE,
  grader_id uuid NOT NULL REFERENCES public.human_pregrade_graders (id),
  PRIMARY KEY (order_id, grader_id)
);

CREATE TABLE IF NOT EXISTS public.human_pregrade_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.human_pregrade_orders (id) ON DELETE CASCADE,
  image_type text NOT NULL,
  source_type text NOT NULL,
  source_upload_id bigint,
  storage_object_id text,
  original_filename text,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0,
  width integer,
  height integer,
  checksum text NOT NULL DEFAULT '',
  customer_caption text,
  reviewer_note text,
  is_active boolean NOT NULL DEFAULT true,
  uploaded_by_user_id uuid REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT human_pregrade_images_type_check CHECK (
    image_type IN ('front','back','front_angled','back_angled','front_corner','back_corner','edge','surface','other','tilt_video')
  ),
  CONSTRAINT human_pregrade_images_source_check CHECK (
    source_type IN ('existing_upload','human_pregrade_upload')
  )
);

CREATE INDEX IF NOT EXISTS human_pregrade_images_order_idx ON public.human_pregrade_images (order_id);

CREATE TABLE IF NOT EXISTS public.human_pregrade_status_history (
  id bigserial PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.human_pregrade_orders (id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  actor_type text NOT NULL,
  actor_id uuid,
  reason_code text,
  reason_text text,
  internal_note text,
  customer_visible_note text,
  notification_required boolean NOT NULL DEFAULT false,
  notification_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS human_pregrade_status_history_order_idx
  ON public.human_pregrade_status_history (order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.human_pregrade_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.human_pregrade_orders (id) ON DELETE CASCADE,
  reviewer_user_id uuid NOT NULL REFERENCES auth.users (id),
  assigned_by_user_id uuid NOT NULL REFERENCES auth.users (id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  released_at timestamptz,
  release_reason text,
  is_current boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS human_pregrade_assignments_one_current_idx
  ON public.human_pregrade_assignments (order_id) WHERE is_current = true;

CREATE TABLE IF NOT EXISTS public.human_pregrade_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.human_pregrade_orders (id) ON DELETE CASCADE,
  reviewer_user_id uuid NOT NULL REFERENCES auth.users (id),
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft',
  overall_condition_score numeric(4,2),
  overall_confidence numeric(4,2),
  centering_score numeric(4,2),
  corners_score numeric(4,2),
  edges_score numeric(4,2),
  surface_score numeric(4,2),
  print_quality_score numeric(4,2),
  eye_appeal_score numeric(4,2),
  image_sufficiency text,
  alteration_risk text,
  authenticity_risk text,
  condition_summary text,
  key_positive_factors text,
  key_negative_factors text,
  main_grade_limiter text,
  submission_recommendation text,
  suggested_grader_id uuid REFERENCES public.human_pregrade_graders (id),
  reviewer_internal_notes text,
  submitted_for_check_at timestamptz,
  approved_at timestamptz,
  approved_by_user_id uuid REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT human_pregrade_assessments_status_check CHECK (
    status IN ('draft','submitted','returned','approved','superseded')
  )
);

CREATE TABLE IF NOT EXISTS public.human_pregrade_grader_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.human_pregrade_assessments (id) ON DELETE CASCADE,
  grader_id uuid NOT NULL REFERENCES public.human_pregrade_graders (id),
  most_likely_grade text NOT NULL,
  minimum_grade text NOT NULL,
  maximum_grade text NOT NULL,
  confidence numeric(4,2) NOT NULL,
  probability_distribution jsonb NOT NULL DEFAULT '{}'::jsonb,
  main_limiter text,
  explanation text,
  qualifier_risk text,
  no_grade_risk text,
  submission_recommendation text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, grader_id)
);

CREATE TABLE IF NOT EXISTS public.human_pregrade_defects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.human_pregrade_assessments (id) ON DELETE CASCADE,
  image_id uuid REFERENCES public.human_pregrade_images (id),
  card_side text,
  category text NOT NULL,
  subtype text,
  severity text NOT NULL,
  confidence numeric(4,2),
  geometry_type text NOT NULL,
  geometry_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  title text NOT NULL,
  description text,
  grading_impact text,
  display_order integer NOT NULL DEFAULT 0,
  customer_visible boolean NOT NULL DEFAULT true,
  created_by_user_id uuid REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.human_pregrade_image_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.human_pregrade_orders (id) ON DELETE CASCADE,
  requested_by_user_id uuid NOT NULL REFERENCES auth.users (id),
  request_type text NOT NULL DEFAULT 'additional_image',
  instructions text NOT NULL,
  required_image_type text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  customer_response text,
  fulfilled_image_id uuid REFERENCES public.human_pregrade_images (id),
  blocks_completion boolean NOT NULL DEFAULT true,
  requested_at timestamptz NOT NULL DEFAULT now(),
  fulfilled_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT human_pregrade_image_requests_status_check CHECK (status IN ('open','fulfilled','cancelled'))
);

CREATE TABLE IF NOT EXISTS public.human_pregrade_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.human_pregrade_orders (id) ON DELETE CASCADE,
  sender_type text NOT NULL,
  sender_id uuid,
  message_type text NOT NULL DEFAULT 'general',
  body text NOT NULL,
  customer_visible boolean NOT NULL DEFAULT true,
  action_required boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.human_pregrade_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.human_pregrade_orders (id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL REFERENCES public.human_pregrade_assessments (id),
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft',
  public_token uuid UNIQUE,
  is_shareable boolean NOT NULL DEFAULT false,
  report_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  html_snapshot text,
  pdf_storage_object_id text,
  template_version text NOT NULL DEFAULT '1.0',
  disclaimer_version text NOT NULL DEFAULT '1.0',
  published_by_user_id uuid REFERENCES auth.users (id),
  published_at timestamptz,
  superseded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT human_pregrade_reports_status_check CHECK (
    status IN ('draft','published','superseded','withdrawn')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS human_pregrade_reports_one_published_idx
  ON public.human_pregrade_reports (order_id) WHERE status = 'published';

CREATE TABLE IF NOT EXISTS public.human_pregrade_audit_log (
  id bigserial PRIMARY KEY,
  order_id uuid REFERENCES public.human_pregrade_orders (id) ON DELETE SET NULL,
  actor_type text NOT NULL,
  actor_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  request_id text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS human_pregrade_audit_log_order_idx
  ON public.human_pregrade_audit_log (order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.human_pregrade_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.human_pregrade_orders (id) ON DELETE CASCADE,
  stripe_session_id text UNIQUE,
  stripe_payment_intent_id text,
  amount_minor_units integer NOT NULL,
  currency text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT human_pregrade_payments_status_check CHECK (
    status IN ('pending','paid','failed','refunded')
  )
);

CREATE TABLE IF NOT EXISTS public.human_pregrade_staff (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  permissions text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.human_pregrade_notification_deliveries (
  id bigserial PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.human_pregrade_orders (id) ON DELETE CASCADE,
  event_type text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  delivered_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.human_pregrade_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.human_pregrade_graders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.human_pregrade_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.human_pregrade_order_graders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.human_pregrade_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.human_pregrade_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.human_pregrade_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.human_pregrade_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.human_pregrade_grader_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.human_pregrade_defects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.human_pregrade_image_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.human_pregrade_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.human_pregrade_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.human_pregrade_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.human_pregrade_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.human_pregrade_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.human_pregrade_notification_deliveries ENABLE ROW LEVEL SECURITY;
