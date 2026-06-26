-- Runtime beta/access settings (admin toggle without redeploy).
create table if not exists public.app_settings (
  id smallint primary key default 1 check (id = 1),
  invite_required boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id, invite_required)
values (1, true)
on conflict (id) do nothing;

alter table public.app_settings enable row level security;

comment on table public.app_settings is
  'Singleton app flags. Service role only — invite_required toggled from admin ops.';

-- Public beta access requests (approved in admin ops).
create table if not exists public.invite_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  message text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  invite_id uuid references public.invites (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists invite_requests_status_created_idx
  on public.invite_requests (status, created_at desc);

create unique index if not exists invite_requests_pending_email_idx
  on public.invite_requests (lower(email))
  where status = 'pending';

alter table public.invite_requests enable row level security;

comment on table public.invite_requests is
  'Beta access requests from /request-access. Admins approve in Operations.';
