# Database schema

All tables use RLS enabled with no client policies (service-role backend only).

Core tables: `human_pregrade_settings`, `human_pregrade_graders`, `human_pregrade_orders`, `human_pregrade_order_graders`, `human_pregrade_images`, `human_pregrade_status_history`, `human_pregrade_assignments`, `human_pregrade_assessments`, `human_pregrade_grader_predictions`, `human_pregrade_defects`, `human_pregrade_image_requests`, `human_pregrade_messages`, `human_pregrade_reports`, `human_pregrade_audit_log`, `human_pregrade_payments`, `human_pregrade_staff`, `human_pregrade_notification_deliveries`.

Migration: `supabase/migrations/20260625120000_human_pregrade_schema.sql`
