-- Inbound contact and trade form submissions (service-role writes only).
create table if not exists public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('contact', 'trade')),
  name text not null,
  email text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists form_submissions_kind_created_at_idx
  on public.form_submissions (kind, created_at desc);

alter table public.form_submissions enable row level security;

comment on table public.form_submissions is
  'Marketing form submissions from /contact and /trade. No client policies — backend service role only.';
