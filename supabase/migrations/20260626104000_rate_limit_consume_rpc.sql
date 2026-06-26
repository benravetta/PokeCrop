-- Atomic rate-limit consume (avoids read-modify-write races across app instances).
CREATE OR REPLACE FUNCTION public.consume_rate_limit_bucket(
  p_bucket_key text,
  p_limit integer,
  p_window_start timestamptz,
  p_expires_at timestamptz
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  IF p_limit <= 0 THEN
    RETURN false;
  END IF;

  UPDATE public.rate_limit_buckets
  SET count = count + 1
  WHERE bucket_key = p_bucket_key AND count < p_limit
  RETURNING count INTO updated_count;

  IF FOUND THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.rate_limit_buckets
    WHERE bucket_key = p_bucket_key AND count >= p_limit
  ) THEN
    RETURN false;
  END IF;

  BEGIN
    INSERT INTO public.rate_limit_buckets (bucket_key, count, window_start, expires_at)
    VALUES (p_bucket_key, 1, p_window_start, p_expires_at);
    RETURN true;
  EXCEPTION WHEN unique_violation THEN
    UPDATE public.rate_limit_buckets
    SET count = count + 1
    WHERE bucket_key = p_bucket_key AND count < p_limit
    RETURNING count INTO updated_count;
    RETURN FOUND;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit_bucket(text, integer, timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_rate_limit_bucket(text, integer, timestamptz, timestamptz) FROM anon;
REVOKE ALL ON FUNCTION public.consume_rate_limit_bucket(text, integer, timestamptz, timestamptz) FROM authenticated;
