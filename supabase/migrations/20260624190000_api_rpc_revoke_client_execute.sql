-- Supabase grants EXECUTE to anon/authenticated by default; revoke explicitly.
REVOKE ALL ON FUNCTION public.claim_api_grade_idempotency(uuid, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_api_grade_idempotency(uuid, text, jsonb) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.release_api_grade_idempotency(uuid, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.get_api_crops_today(uuid) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_api_grade_idempotency(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_api_grade_idempotency(uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_api_grade_idempotency(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_api_crops_today(uuid) TO service_role;
