-- Richer admin catalog rows: pipeline metadata + optional centring measurement.

alter table public.catalog_items
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists centring jsonb,
  add column if not exists pipeline_confidence numeric;

comment on column public.catalog_items.pipeline_confidence is
  'OpenCV pipeline edge-detection confidence (0–1).';
comment on column public.catalog_items.centring is
  'Measured border ratios and grader centring subgrades when available.';
