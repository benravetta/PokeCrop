-- GemCheck Collector Profiles — additive schema only.

CREATE TABLE IF NOT EXISTS public.collector_profile_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  collector_profiles_enabled boolean NOT NULL DEFAULT false,
  collector_profile_messaging_enabled boolean NOT NULL DEFAULT false,
  collector_profile_grading_enabled boolean NOT NULL DEFAULT false,
  collector_profile_discovery_enabled boolean NOT NULL DEFAULT false,
  collector_profile_trade_enquiries_enabled boolean NOT NULL DEFAULT false,
  username_change_interval_days integer NOT NULL DEFAULT 30,
  username_redirect_days integer NOT NULL DEFAULT 90,
  max_cards_per_profile integer NOT NULL DEFAULT 500,
  max_wanted_entries integer NOT NULL DEFAULT 200,
  max_trade_enquiries_per_day integer NOT NULL DEFAULT 20,
  max_messages_per_minute integer NOT NULL DEFAULT 30,
  max_new_conversations_per_hour integer NOT NULL DEFAULT 10,
  max_profile_image_bytes bigint NOT NULL DEFAULT 5242880,
  max_card_image_bytes bigint NOT NULL DEFAULT 15728640,
  max_message_attachment_bytes bigint NOT NULL DEFAULT 5242880,
  allow_viewer_grading_default boolean NOT NULL DEFAULT true,
  supported_card_games text[] NOT NULL DEFAULT ARRAY['Pokemon'],
  external_link_policy text NOT NULL DEFAULT 'warn',
  report_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  message_retention_days integer NOT NULL DEFAULT 365,
  require_admin_access_reason boolean NOT NULL DEFAULT true,
  notification_templates jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.collector_profile_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.collector_profile_staff (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  permissions text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.collector_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  username text NOT NULL,
  display_name text NOT NULL,
  bio text,
  profile_image_storage_id text,
  cover_image_storage_id text,
  location_region text,
  country_code text,
  accent_setting text,
  appearance_setting text NOT NULL DEFAULT 'light',
  visibility text NOT NULL DEFAULT 'private',
  search_visible boolean NOT NULL DEFAULT false,
  search_engine_indexing boolean NOT NULL DEFAULT false,
  trade_enquiries_enabled boolean NOT NULL DEFAULT true,
  messaging_enabled boolean NOT NULL DEFAULT true,
  allow_viewer_grading boolean NOT NULL DEFAULT true,
  featured_card_id uuid,
  status text NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT collector_profiles_username_lower_unique UNIQUE (username),
  CONSTRAINT collector_profiles_visibility_check CHECK (visibility IN ('public', 'unlisted', 'private')),
  CONSTRAINT collector_profiles_status_check CHECK (status IN ('draft', 'active', 'hidden', 'suspended', 'deleted')),
  CONSTRAINT collector_profiles_appearance_check CHECK (appearance_setting IN ('light', 'dark'))
);

CREATE UNIQUE INDEX IF NOT EXISTS collector_profiles_username_ci_idx ON public.collector_profiles (lower(username));

CREATE TABLE IF NOT EXISTS public.collector_profile_username_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.collector_profiles (id) ON DELETE CASCADE,
  previous_username text NOT NULL,
  new_username text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  redirect_expires_at timestamptz
);

CREATE INDEX IF NOT EXISTS collector_profile_username_history_prev_idx
  ON public.collector_profile_username_history (lower(previous_username), redirect_expires_at DESC);

CREATE TABLE IF NOT EXISTS public.collector_profile_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.collector_profiles (id) ON DELETE CASCADE,
  interest_type text NOT NULL,
  interest_value text NOT NULL,
  display_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.collector_profile_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.collector_profiles (id) ON DELETE CASCADE,
  platform text NOT NULL,
  label text NOT NULL,
  url text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.collector_profile_section_order (
  profile_id uuid NOT NULL REFERENCES public.collector_profiles (id) ON DELETE CASCADE,
  section text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  PRIMARY KEY (profile_id, section),
  CONSTRAINT collector_profile_section_order_section_check CHECK (
    section IN ('showcase', 'for_trade', 'wanted', 'about', 'links')
  )
);

CREATE TABLE IF NOT EXISTS public.collector_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.collector_profiles (id) ON DELETE CASCADE,
  public_id text NOT NULL UNIQUE,
  source_card_id bigint,
  source_scan_id bigint,
  source_ai_report_id bigint,
  source_expert_report_id uuid,
  card_game text NOT NULL DEFAULT 'Pokemon',
  card_name text NOT NULL,
  set_name text,
  set_code text,
  card_number text,
  release_year integer,
  language text,
  variant text,
  rarity text,
  finish_type text,
  edition text,
  ownership_type text NOT NULL DEFAULT 'owned',
  card_state text NOT NULL DEFAULT 'raw',
  grading_company text,
  official_grade text,
  official_subgrades jsonb,
  certification_number text,
  condition text,
  quantity integer NOT NULL DEFAULT 1,
  trade_status text NOT NULL DEFAULT 'not_available',
  trade_value_minor_units integer,
  trade_value_currency text,
  public_description text,
  trade_notes text,
  owner_private_notes text,
  wanted_notes text,
  wanted_priority text,
  wanted_preferred_grader text,
  wanted_min_grade text,
  wanted_max_grade text,
  wanted_min_condition text,
  visibility text NOT NULL DEFAULT 'public',
  allow_viewer_grading_override text NOT NULL DEFAULT 'inherit_profile_setting',
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT collector_cards_ownership_check CHECK (ownership_type IN ('owned', 'wanted')),
  CONSTRAINT collector_cards_state_check CHECK (card_state IN ('raw', 'graded', 'unknown')),
  CONSTRAINT collector_cards_trade_status_check CHECK (
    trade_status IN ('available', 'open_to_offers', 'pending', 'reserved', 'traded', 'not_available')
  ),
  CONSTRAINT collector_cards_visibility_check CHECK (visibility IN ('public', 'unlisted', 'private')),
  CONSTRAINT collector_cards_grading_override_check CHECK (
    allow_viewer_grading_override IN ('inherit_profile_setting', 'allow', 'disallow')
  ),
  CONSTRAINT collector_cards_status_check CHECK (
    status IN ('draft', 'processing', 'active', 'hidden', 'removed', 'traded', 'deleted')
  ),
  CONSTRAINT collector_cards_wanted_priority_check CHECK (
    wanted_priority IS NULL OR wanted_priority IN ('low', 'normal', 'high', 'grail')
  )
);

CREATE INDEX IF NOT EXISTS collector_cards_profile_idx ON public.collector_cards (profile_id, status);
CREATE INDEX IF NOT EXISTS collector_cards_owner_idx ON public.collector_cards (owner_user_id, created_at DESC);

ALTER TABLE public.collector_profiles
  ADD CONSTRAINT collector_profiles_featured_card_fk
  FOREIGN KEY (featured_card_id) REFERENCES public.collector_cards (id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.collector_card_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.collector_cards (id) ON DELETE CASCADE,
  section text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT collector_card_sections_section_check CHECK (
    section IN ('showcase', 'for_trade', 'wanted', 'private_collection')
  ),
  CONSTRAINT collector_card_sections_unique UNIQUE (card_id, section)
);

CREATE TABLE IF NOT EXISTS public.collector_card_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.collector_cards (id) ON DELETE CASCADE,
  image_role text NOT NULL,
  source_type text NOT NULL DEFAULT 'upload',
  source_storage_id text,
  original_storage_id text,
  processed_storage_id text,
  thumbnail_storage_id text,
  width integer,
  height integer,
  mime_type text,
  size_bytes bigint,
  checksum text,
  crop_data jsonb,
  perspective_data jsonb,
  processing_status text NOT NULL DEFAULT 'uploaded',
  confirmed_by_user boolean NOT NULL DEFAULT false,
  is_public_derivative boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT collector_card_images_role_check CHECK (
    image_role IN ('front', 'back', 'front_additional', 'back_additional', 'detail', 'slab_front', 'slab_back')
  ),
  CONSTRAINT collector_card_images_status_check CHECK (
    processing_status IN ('uploaded', 'validating', 'processing', 'requires_manual_crop', 'ready', 'failed')
  )
);

CREATE TABLE IF NOT EXISTS public.collector_card_grade_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.collector_cards (id) ON DELETE CASCADE,
  grading_order_id bigint,
  grading_report_id bigint,
  initiated_by_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  relationship_type text NOT NULL,
  publication_status text NOT NULL DEFAULT 'private',
  published_by_owner_at timestamptz,
  source_front_image_version uuid,
  source_back_image_version uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT collector_card_grade_links_relationship_check CHECK (
    relationship_type IN ('owner_initiated', 'viewer_initiated', 'imported_existing_owner_grade', 'expert_review', 'official_grade')
  ),
  CONSTRAINT collector_card_grade_links_publication_check CHECK (
    publication_status IN ('private', 'owner_visible', 'public_summary', 'public_full_report', 'ineligible_for_owner_publication')
  )
);

CREATE TABLE IF NOT EXISTS public.collector_entitlement_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES public.collector_cards (id) ON DELETE CASCADE,
  entitlement_type text NOT NULL,
  status text NOT NULL DEFAULT 'reserved',
  expires_at timestamptz NOT NULL,
  stripe_session_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT collector_entitlement_reservations_type_check CHECK (
    entitlement_type IN ('subscription', 'credit', 'promotional', 'one_off')
  ),
  CONSTRAINT collector_entitlement_reservations_status_check CHECK (
    status IN ('reserved', 'consumed', 'released', 'expired')
  )
);

CREATE TABLE IF NOT EXISTS public.collector_trade_enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL UNIQUE,
  sender_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  recipient_profile_id uuid NOT NULL REFERENCES public.collector_profiles (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft',
  cash_difference_minor_units integer,
  cash_difference_currency text,
  fulfilment_preference text,
  location_region text,
  initial_message text,
  conversation_id uuid,
  sent_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT collector_trade_enquiries_status_check CHECK (
    status IN ('draft', 'sent', 'viewed', 'interested', 'declined', 'negotiating', 'pending', 'completed', 'cancelled', 'reported')
  )
);

CREATE TABLE IF NOT EXISTS public.collector_trade_enquiry_requested_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_enquiry_id uuid NOT NULL REFERENCES public.collector_trade_enquiries (id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES public.collector_cards (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.collector_trade_enquiry_offered_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_enquiry_id uuid NOT NULL REFERENCES public.collector_trade_enquiries (id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES public.collector_cards (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.collector_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL UNIQUE,
  conversation_type text NOT NULL DEFAULT 'general',
  trade_enquiry_id uuid REFERENCES public.collector_trade_enquiries (id) ON DELETE SET NULL,
  card_id uuid REFERENCES public.collector_cards (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  created_by_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  last_message_at timestamptz,
  admin_intervention_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT collector_conversations_type_check CHECK (
    conversation_type IN ('general', 'trade_enquiry', 'card_enquiry', 'support_intervention', 'moderation')
  ),
  CONSTRAINT collector_conversations_status_check CHECK (
    status IN ('active', 'archived', 'frozen', 'closed', 'reported')
  )
);

ALTER TABLE public.collector_trade_enquiries
  ADD CONSTRAINT collector_trade_enquiries_conversation_fk
  FOREIGN KEY (conversation_id) REFERENCES public.collector_conversations (id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.collector_conversation_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.collector_conversations (id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  admin_user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  participant_role text NOT NULL DEFAULT 'user',
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  last_read_message_id uuid,
  is_muted boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  CONSTRAINT collector_conversation_participants_role_check CHECK (
    participant_role IN ('user', 'administrator', 'moderator', 'system')
  )
);

CREATE TABLE IF NOT EXISTS public.collector_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.collector_conversations (id) ON DELETE CASCADE,
  sender_participant_id uuid NOT NULL REFERENCES public.collector_conversation_participants (id) ON DELETE CASCADE,
  message_type text NOT NULL DEFAULT 'text',
  body text,
  reply_to_message_id uuid REFERENCES public.collector_messages (id) ON DELETE SET NULL,
  card_id uuid REFERENCES public.collector_cards (id) ON DELETE SET NULL,
  attachment_storage_id text,
  status text NOT NULL DEFAULT 'sent',
  sent_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  hidden_by_sender_at timestamptz,
  removed_by_moderator_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT collector_messages_type_check CHECK (
    message_type IN ('text', 'card_reference', 'trade_summary', 'image', 'system', 'moderator_notice')
  ),
  CONSTRAINT collector_messages_status_check CHECK (
    status IN ('sent', 'delivered', 'removed', 'moderated')
  )
);

ALTER TABLE public.collector_conversation_participants
  ADD CONSTRAINT collector_conversation_participants_last_read_fk
  FOREIGN KEY (last_read_message_id) REFERENCES public.collector_messages (id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.collector_user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocking_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  blocked_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT collector_user_blocks_unique UNIQUE (blocking_user_id, blocked_user_id)
);

CREATE TABLE IF NOT EXISTS public.collector_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL UNIQUE,
  reporter_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  reported_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  conversation_id uuid REFERENCES public.collector_conversations (id) ON DELETE SET NULL,
  message_id uuid REFERENCES public.collector_messages (id) ON DELETE SET NULL,
  reason_code text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT collector_reports_status_check CHECK (
    status IN ('open', 'triaged', 'under_review', 'awaiting_information', 'action_taken', 'no_action', 'escalated', 'resolved', 'appealed', 'closed')
  )
);

CREATE TABLE IF NOT EXISTS public.collector_moderation_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL UNIQUE,
  source_report_id uuid REFERENCES public.collector_reports (id) ON DELETE SET NULL,
  subject_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'normal',
  assigned_admin_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  summary text,
  resolution text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT collector_moderation_cases_status_check CHECK (
    status IN ('open', 'triaged', 'under_review', 'awaiting_information', 'action_taken', 'no_action', 'escalated', 'resolved', 'appealed', 'closed')
  )
);

CREATE TABLE IF NOT EXISTS public.collector_moderation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.collector_moderation_cases (id) ON DELETE CASCADE,
  admin_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  action_type text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  reason text NOT NULL,
  expires_at timestamptz,
  reversed_at timestamptz,
  reversed_by_admin_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.collector_admin_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.collector_moderation_cases (id) ON DELETE CASCADE,
  admin_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.collector_conversations (id) ON DELETE SET NULL,
  access_type text NOT NULL,
  access_reason text NOT NULL,
  scope text NOT NULL,
  request_id text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.collector_notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  event_type text NOT NULL,
  entity_id text,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: service-role only (no client policies)
ALTER TABLE public.collector_profile_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collector_profile_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collector_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collector_profile_username_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collector_profile_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collector_profile_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collector_profile_section_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collector_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collector_card_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collector_card_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collector_card_grade_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collector_entitlement_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collector_trade_enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collector_trade_enquiry_requested_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collector_trade_enquiry_offered_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collector_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collector_conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collector_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collector_user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collector_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collector_moderation_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collector_moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collector_admin_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collector_notification_deliveries ENABLE ROW LEVEL SECURITY;
