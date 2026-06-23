-- Durable API grade idempotency + account-level crop usage helper.

CREATE TABLE IF NOT EXISTS public.api_grade_idempotency (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'complete')),
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  PRIMARY KEY (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS api_grade_idempotency_expires_idx
  ON public.api_grade_idempotency (expires_at);

ALTER TABLE public.api_grade_idempotency ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.claim_api_grade_idempotency(p_user uuid, p_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.api_grade_idempotency%ROWTYPE;
BEGIN
  SELECT * INTO row FROM public.api_grade_idempotency
  WHERE user_id = p_user AND idempotency_key = p_key;

  IF FOUND THEN
    IF row.status = 'complete' AND row.response_body IS NOT NULL THEN
      RETURN jsonb_build_object('action', 'replay', 'body', row.response_body);
    END IF;
    IF row.status = 'pending' AND row.created_at > now() - interval '10 minutes' THEN
      RETURN jsonb_build_object('action', 'wait', 'retry_after', 30);
    END IF;
    DELETE FROM public.api_grade_idempotency
    WHERE user_id = p_user AND idempotency_key = p_key;
  END IF;

  INSERT INTO public.api_grade_idempotency (user_id, idempotency_key, status)
  VALUES (p_user, p_key, 'pending');

  RETURN jsonb_build_object('action', 'claimed');
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_api_grade_idempotency(
  p_user uuid,
  p_key text,
  p_body jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.api_grade_idempotency
  SET
    status = 'complete',
    response_body = p_body,
    expires_at = now() + interval '24 hours'
  WHERE user_id = p_user AND idempotency_key = p_key AND status = 'pending';
END;
$$;

CREATE OR REPLACE FUNCTION public.release_api_grade_idempotency(p_user uuid, p_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.api_grade_idempotency
  WHERE user_id = p_user AND idempotency_key = p_key AND status = 'pending';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_api_crops_today(p_user uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(u.count), 0)::integer
  FROM public.api_usage u
  INNER JOIN public.api_keys k ON k.id = u.key_id
  WHERE k.user_id = p_user AND u.day = CURRENT_DATE;
$$;

REVOKE ALL ON FUNCTION public.claim_api_grade_idempotency(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_api_grade_idempotency(uuid, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_api_grade_idempotency(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_api_crops_today(uuid) FROM PUBLIC;
