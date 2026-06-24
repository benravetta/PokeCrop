-- Per-user crop catalogue: straightened PNG + pipeline metadata + optional centring.

create table if not exists public.user_crops (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  content_hash text not null,
  r2_key text,
  summary text not null,
  tcg text,
  card_set text,
  number text,
  name text,
  confidence numeric,
  pipeline_confidence numeric,
  width int,
  height int,
  metadata jsonb not null default '{}'::jsonb,
  centring jsonb,
  source text not null default 'web',
  created_at timestamptz not null default now()
);

create index if not exists user_crops_user_created_idx
  on public.user_crops (user_id, created_at desc);

create index if not exists user_crops_user_hash_idx
  on public.user_crops (user_id, content_hash);

alter table public.user_crops enable row level security;

create policy user_crops_select_own on public.user_crops
  for select using (auth.uid() = user_id);

comment on table public.user_crops is
  'User crop library — straightened cards with pipeline metadata and optional centring measurement.';
