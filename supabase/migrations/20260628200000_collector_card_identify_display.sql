-- Collector card identification + display-tier images + crop metering per image role.

ALTER TABLE public.collector_cards
  ADD COLUMN IF NOT EXISTS identification_extra jsonb,
  ADD COLUMN IF NOT EXISTS identification_confidence numeric,
  ADD COLUMN IF NOT EXISTS identified_at timestamptz,
  ADD COLUMN IF NOT EXISTS identification_source text;

ALTER TABLE public.collector_card_images
  ADD COLUMN IF NOT EXISTS display_storage_id text,
  ADD COLUMN IF NOT EXISTS crop_usage_counted boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.collector_cards.identification_extra IS
  'Raw rich ID payload (identifiers, holo_type, set_total, etc.)';
COMMENT ON COLUMN public.collector_card_images.display_storage_id IS
  'Watermarked/resized WebP or JPEG for proxy display — never full-res PNG';
