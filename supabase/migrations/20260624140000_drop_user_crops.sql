-- user_crops superseded by crop attributes on usage_events.detail

drop policy if exists user_crops_select_own on public.user_crops;
drop table if exists public.user_crops;
