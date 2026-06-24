-- Supabase grants EXECUTE to anon/authenticated by default; revoke explicitly.
REVOKE ALL ON FUNCTION public.admin_overview() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.ai_spend_summary(int) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.catalog_facets(text, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_user_emails(uuid[]) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.prune_admin_audit_log() FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.admin_overview() TO service_role;
GRANT EXECUTE ON FUNCTION public.ai_spend_summary(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.catalog_facets(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_user_emails(uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.prune_admin_audit_log() TO service_role;
