-- Beta invite-only registration. Service role only — no client policies.
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token_hash text not null unique,
  role text not null default 'user' check (role in ('user', 'admin')),
  invited_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists invites_email_idx on public.invites (lower(email));
create index if not exists invites_created_at_idx on public.invites (created_at desc);
create index if not exists invites_pending_idx on public.invites (expires_at)
  where accepted_at is null;

alter table public.invites enable row level security;

comment on table public.invites is
  'Beta registration invites. Backend service role only — admins send via /api/admin/invites.';
