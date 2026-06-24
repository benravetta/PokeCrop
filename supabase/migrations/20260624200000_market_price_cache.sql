-- Cache for market pricing / eBay sold lookup results (service role only).
CREATE TABLE IF NOT EXISTS public.market_price_cache (
  cache_key text PRIMARY KEY,
  source text NOT NULL DEFAULT 'mixed',
  payload jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS market_price_cache_expires_idx
  ON public.market_price_cache (expires_at);

ALTER TABLE public.market_price_cache ENABLE ROW LEVEL SECURITY;

-- No client policies — backend service role only.
