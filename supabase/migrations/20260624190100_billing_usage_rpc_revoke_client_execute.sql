-- Lock down billing, grade, and usage RPCs to service_role only.
REVOKE ALL ON FUNCTION public.increment_grade(uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.credit_grade_purchase(uuid, text, text, integer) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.refund_grade_purchase(text, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_grade_purchase_disputed(text) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.increment_grade(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.credit_grade_purchase(uuid, text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_grade_purchase(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_grade_purchase_disputed(text) TO service_role;
