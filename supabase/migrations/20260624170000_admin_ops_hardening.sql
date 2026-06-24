-- Lock down admin RPCs and add batch email lookup for ops console.

REVOKE ALL ON FUNCTION public.admin_overview() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ai_spend_summary(int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.catalog_facets(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_overview() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.ai_spend_summary(int) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.catalog_facets(text, text) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.admin_overview() TO service_role;
GRANT EXECUTE ON FUNCTION public.ai_spend_summary(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.catalog_facets(text, text) TO service_role;

-- Batch email resolution for admin list endpoints (service role only).
CREATE OR REPLACE FUNCTION public.admin_user_emails(p_ids uuid[])
RETURNS TABLE(user_id uuid, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.email
  FROM auth.users u
  WHERE u.id = ANY(p_ids);
$$;

REVOKE ALL ON FUNCTION public.admin_user_emails(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_user_emails(uuid[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_emails(uuid[]) TO service_role;

-- Prune audit rows older than 90 days (call from a scheduled job).
CREATE OR REPLACE FUNCTION public.prune_admin_audit_log()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.admin_audit_log
  WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_admin_audit_log() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prune_admin_audit_log() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_admin_audit_log() TO service_role;
