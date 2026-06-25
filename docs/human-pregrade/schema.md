# Database schema

## Access model (RLS)

All `human_pregrade_*` tables use **Row Level Security enabled with no client-facing policies**. This is intentional:

- The Supabase **anon** and **authenticated** keys cannot read or write these tables directly.
- All application access goes through the Express backend using the **service role** key, which bypasses RLS.
- This deny-by-default model avoids accidental exposure if a policy is misconfigured later.

The same pattern applies to `rate_limit_buckets` (Postgres-backed rate limiting).

If direct client access is ever required, add explicit least-privilege policies per table — do not rely on RLS being “off.”

## Core tables

`human_pregrade_settings`, `human_pregrade_graders`, `human_pregrade_orders`, `human_pregrade_order_graders`, `human_pregrade_images`, `human_pregrade_status_history`, `human_pregrade_assignments`, `human_pregrade_assessments`, `human_pregrade_grader_predictions`, `human_pregrade_defects`, `human_pregrade_image_requests`, `human_pregrade_messages`, `human_pregrade_reports`, `human_pregrade_audit_log`, `human_pregrade_payments`, `human_pregrade_staff`, `human_pregrade_notification_deliveries`.

Supporting: `rate_limit_buckets` — distributed rate limit counters (service-role only).

## Migrations

- Human pre-grade schema: `supabase/migrations/20260625120000_human_pregrade_schema.sql`
- Rate limit buckets: `supabase/migrations/20260625140000_rate_limit_buckets.sql`
