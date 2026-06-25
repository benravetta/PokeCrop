CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  bucket_key text PRIMARY KEY,
  count integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS rate_limit_buckets_expires_idx
  ON public.rate_limit_buckets (expires_at);

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
