-- Weekly prune of admin_audit_log (Sundays 03:30 UTC).
SELECT cron.schedule(
  'prune-admin-audit-log',
  '30 3 * * 0',
  $$SELECT public.prune_admin_audit_log();$$
);
