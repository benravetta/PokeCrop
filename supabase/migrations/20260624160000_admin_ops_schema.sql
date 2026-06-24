-- Admin ops console: RPCs, constraint fixes, audit log.

-- Allow pro plan and admin billing on usage events.
alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions add constraint subscriptions_plan_check
  check (plan in ('free', 'unlimited', 'pro', 'api'));

alter table public.usage_events drop constraint if exists usage_events_billing_check;
alter table public.usage_events add constraint usage_events_billing_check
  check (billing in ('free', 'subscription', 'one_off', 'admin'));

-- Longer-retention audit trail for admin mutations (separate from 2-day activity_log).
create table if not exists public.admin_audit_log (
  id bigserial primary key,
  actor_id uuid not null,
  actor_email text,
  action text not null,
  target_user_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_at_idx
  on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;

comment on table public.admin_audit_log is
  'Admin mutation audit trail. Prune rows older than ~90 days via scheduled job.';

-- Replace legacy return types (json / TABLE) with jsonb aggregates.
DROP FUNCTION IF EXISTS public.admin_overview();
DROP FUNCTION IF EXISTS public.ai_spend_summary(integer);
DROP FUNCTION IF EXISTS public.catalog_facets(text, text);

-- Dashboard aggregates for /api/admin/stats
create or replace function public.admin_overview()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with today as (
    select (timezone('utc', now()))::date as d
  )
  select jsonb_build_object(
    'users_total', (select count(*)::int from auth.users),
    'unlimited_active', (
      select count(*)::int from public.subscriptions
      where plan = 'unlimited' and status in ('active', 'trialing')
    ),
    'pro_active', (
      select count(*)::int from public.subscriptions
      where plan = 'pro' and status in ('active', 'trialing')
    ),
    'api_active', (
      select count(*)::int from public.subscriptions
      where plan = 'api' and status in ('active', 'trialing')
    ),
    'free_active', (
      select count(*)::int from auth.users u
      where not exists (
        select 1 from public.subscriptions s
        where s.user_id = u.id
          and s.plan <> 'free'
          and s.status in ('active', 'trialing')
      )
    ),
    'suspended', (
      select count(*)::int from auth.users
      where banned_until is not null and banned_until > now()
    ),
    'crops_web_today', (
      select coalesce(sum(ud.crop_count), 0)::int
      from public.usage_days ud, today t
      where ud.day = t.d
    ),
    'crops_api_today', (
      select coalesce(sum(au.count), 0)::int
      from public.api_usage au
      cross join today t
      where au.day = t.d
    ),
    'grades_today', (
      select coalesce(sum(gu.count), 0)::int
      from public.grade_usage gu
      cross join today t
      where gu.day = t.d
    ),
    'grade_purchases_today', (
      select count(*)::int
      from public.grade_purchases gp
      cross join today t
      where gp.status = 'completed'
        and gp.credited_at is not null
        and (gp.credited_at at time zone 'utc')::date = t.d
    ),
    'grade_credits_outstanding', (
      select coalesce(sum(grade_credits), 0)::int from public.subscriptions
    ),
    'active_keys', (
      select count(*)::int from public.api_keys where revoked_at is null
    ),
    'forms_total', (
      select count(*)::int from public.form_submissions
    )
  );
$$;

-- Token-exact OpenAI spend rollup for admin dashboard.
create or replace function public.ai_spend_summary(p_days int)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select greatest(1, least(coalesce(p_days, 30), 180)) as days
  ),
  windowed as (
    select *
    from public.ai_usage, bounds b
    where created_at >= (now() at time zone 'utc') - (b.days || ' days')::interval
  ),
  totals as (
    select
      coalesce(sum(cost_usd), 0)::numeric(12, 4) as total_cost_usd,
      count(*)::int as total_calls
    from windowed
  ),
  by_feature as (
    select feature, count(*)::int as calls, coalesce(sum(cost_usd), 0)::numeric(12, 4) as cost_usd
    from windowed
    group by feature
    order by cost_usd desc
  ),
  by_day as (
    select (created_at at time zone 'utc')::date as day,
           coalesce(sum(cost_usd), 0)::numeric(12, 4) as cost_usd
    from windowed
    group by 1
    order by 1
  )
  select jsonb_build_object(
    'total_cost_usd', (select total_cost_usd from totals),
    'total_calls', (select total_calls from totals),
    'by_feature', coalesce((
      select jsonb_agg(jsonb_build_object(
        'feature', feature,
        'calls', calls,
        'cost_usd', cost_usd
      ) order by cost_usd desc)
      from by_feature
    ), '[]'::jsonb),
    'by_day', coalesce((
      select jsonb_agg(jsonb_build_object(
        'day', day,
        'cost_usd', cost_usd
      ) order by day)
      from by_day
    ), '[]'::jsonb)
  );
$$;

-- Catalog tree navigation counts.
create or replace function public.catalog_facets(p_tcg text default null, p_set text default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('label', label, 'count', cnt) order by label), '[]'::jsonb)
  from (
    select
      case
        when p_tcg is null then tcg
        when p_set is null then card_set
        else number
      end as label,
      count(*)::int as cnt
    from public.catalog_items
    where (p_tcg is null or tcg = p_tcg)
      and (p_set is null or card_set = p_set)
    group by 1
  ) sub
  where label is not null and label <> '';
$$;
