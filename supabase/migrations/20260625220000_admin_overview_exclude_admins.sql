-- Exclude admin accounts from plan/revenue dashboard aggregates.

create or replace function public.admin_overview()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with today as (
    select (timezone('utc', now()))::date as d
  ),
  admin_users as (
    select u.id
    from auth.users u
    where coalesce(u.raw_app_meta_data->>'role', '') = 'admin'
  )
  select jsonb_build_object(
    'users_total', (select count(*)::int from auth.users),
    'unlimited_active', (
      select count(*)::int from public.subscriptions s
      where s.plan = 'unlimited'
        and s.status in ('active', 'trialing')
        and s.user_id not in (select id from admin_users)
    ),
    'pro_active', (
      select count(*)::int from public.subscriptions s
      where s.plan = 'pro'
        and s.status in ('active', 'trialing')
        and s.user_id not in (select id from admin_users)
    ),
    'api_active', (
      select count(*)::int from public.subscriptions s
      where s.plan = 'api'
        and s.status in ('active', 'trialing')
        and s.user_id not in (select id from admin_users)
    ),
    'free_active', (
      select count(*)::int from auth.users u
      where u.id not in (select id from admin_users)
        and not exists (
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
        and gp.user_id not in (select id from admin_users)
    ),
    'grade_credits_outstanding', (
      select coalesce(sum(s.grade_credits), 0)::int
      from public.subscriptions s
      where s.user_id not in (select id from admin_users)
    ),
    'active_keys', (
      select count(*)::int from public.api_keys where revoked_at is null
    ),
    'forms_total', (
      select count(*)::int from public.form_submissions
    )
  );
$$;
