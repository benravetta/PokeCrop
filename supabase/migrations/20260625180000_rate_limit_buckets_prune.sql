-- Hourly cleanup of expired human-pregrade rate limit buckets.
SELECT cron.schedule(
  'prune-rate-limit-buckets',
  '15 * * * *',
  $$DELETE FROM public.rate_limit_buckets WHERE expires_at < now()$$
);
