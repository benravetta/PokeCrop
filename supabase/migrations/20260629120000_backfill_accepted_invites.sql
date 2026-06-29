-- Mark invites accepted when a confirmed user already exists for the invite email.
-- Fixes rows left pending after email-confirmation signup used /auth/exchange.
with matched as (
  select distinct on (lower(trim(i.email)))
    i.id as invite_id,
    u.id as user_id,
    coalesce(u.email_confirmed_at, u.confirmed_at, u.created_at) as accepted_at
  from public.invites i
  inner join auth.users u on lower(trim(i.email)) = lower(trim(u.email))
  where i.accepted_at is null
    and coalesce(u.email_confirmed_at, u.confirmed_at) is not null
  order by lower(trim(i.email)), i.created_at desc
)
update public.invites i
set
  accepted_at = m.accepted_at,
  accepted_by = m.user_id
from matched m
where i.id = m.invite_id;
