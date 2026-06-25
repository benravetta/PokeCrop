# Next Phase Plan — Post-Security Remediation

**Status:** Operational setup started (2026-06-25)  
**Prerequisite:** Security findings 1–16 code remediation merged/deployed

---

## Phase 2A — Deploy & verify (immediate)

| Step | Owner | Status |
|------|-------|--------|
| Apply `rate_limit_buckets` migration on Supabase | Ops | Done |
| Set Fly secrets: `CSRF_SECRET`, `SUPABASE_PUBLISHABLE_KEY`, `HUMAN_PREGRADE_RATE_LIMIT_STORE=postgres`, `TRUST_PROXY_HOPS=1` | Ops | Done |
| Sync local `.env` for docker-compose backend (`env_file`) | Dev | Done |
| Deploy latest image to Fly (`fly deploy`) | Ops | **Pending** — code with BFF auth + nginx headers must ship |
| Manual smoke on production | QA | Pending |

### Production smoke checklist

- [ ] `GET https://gemcheck.co.uk/api/health` → 200
- [ ] Response headers include `X-Content-Type-Options`, CSP-Report-Only
- [ ] Register / login / logout (cookies set, no tokens in localStorage)
- [ ] Mutating API call fails without CSRF, succeeds after login
- [ ] Password reset email → `/reset-password` hash exchange → session cookie
- [ ] Crop tool + billing checkout still work
- [ ] Human pre-grade checkout (if enabled) respects rate limits
- [ ] Admin review page loads; reviewer DTO hides `user_id`

---

## Phase 2B — CSP enforcement (1–2 week soak)

1. Monitor browser console + nginx/CSP report endpoint for violations during normal usage.
2. Tune CSP in `deploy/fly/nginx.conf` and `frontend/nginx.conf` if violations are false positives (Stripe redirect, signed R2 URLs, etc.).
3. Switch `Content-Security-Policy-Report-Only` → `Content-Security-Policy` in both nginx configs.
4. Re-run smoke checklist after enforcement.

---

## Phase 2C — Auth hardening cleanup

| Task | Why |
|------|-----|
| Remove `Authorization: Bearer` fallback in `auth.ts` after soak | Completes Finding 7 migration |
| Move `AccountPage` profile read/write to `/api/me` BFF routes | Stops direct Supabase client DB access from browser |
| Add auth route integration tests with mocked Supabase | Regression guard for cookie + CSRF flows |
| Document session invalidation on password change | Ops runbook |

---

## Phase 2D — Rate limit hygiene

| Task | Notes |
|------|-------|
| Scheduled cleanup of expired `rate_limit_buckets` rows | pg_cron or Supabase scheduled job: `DELETE FROM rate_limit_buckets WHERE expires_at < now()` |
| Metrics/alerts on 429 rate for human-pregrade routes | Fly logs or external APM |
| Validate nginx `limit_req` + Postgres store together under load | Optional k6 script |

---

## Phase 2E — Human pre-grade product (optional)

| Task | Finding |
|------|---------|
| Implement share API per `docs/human-pregrade/share-api.md` | Finding 9 |
| Enable `HUMAN_PREGRADE_ENABLED=1` + Stripe price on Fly | Product launch |
| Staff onboarding: reviewer permissions in `human_pregrade_staff` | Ops |

---

## Phase 2F — PR / release structure (if not done)

Split the security remediation into reviewable PRs in merge order:

1. PR1 validation → PR2 messages → PR3 frontend → PR4 headers  
2. PR5 rate limits → PR6 admin DTO → PR7 auth BFF → PR8 docs  

Or ship as a single release if already integrated on `main`.

---

## Environment reference

| Variable | Local (`.env`) | Fly |
|----------|----------------|-----|
| `CSRF_SECRET` | Set | Secret |
| `SUPABASE_PUBLISHABLE_KEY` | Set | Secret |
| `SUPABASE_SERVICE_ROLE_KEY` | Set (from Fly) | Secret |
| `HUMAN_PREGRADE_RATE_LIMIT_STORE` | `memory` | `postgres` |
| `TRUST_PROXY_HOPS` | `1` | `1` (also in `fly.toml`) |

---

## Success criteria

Phase 2 complete when:

1. Production runs cookie auth with CSRF and passes smoke checklist.
2. CSP is enforcing with no critical violations.
3. Postgres rate limits active (`rate_limit_buckets` receiving rows under load).
4. Bearer fallback removed or scheduled for removal with documented date.
