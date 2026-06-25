# Next Phase Plan — Post-Security Remediation

**Status:** Phases 2A–2F implemented (2026-06-25)  
**Prerequisite:** Security findings 1–16 code remediation merged/deployed

---

## Phase 2A — Deploy & verify ✅

| Step | Status |
|------|--------|
| Apply `rate_limit_buckets` migration on Supabase | Done |
| Set Fly secrets (CSRF, publishable key, rate limit store, trust proxy) | Done |
| Sync local `.env` for docker-compose backend | Done |
| Deploy latest image to Fly | Done |
| Production smoke (health + security headers) | Done — `GET /api/health` 200, CSP + nosniff headers present |

### Manual smoke checklist (ongoing QA)

- [x] `GET https://gemcheck.co.uk/api/health` → 200
- [x] Response headers include `X-Content-Type-Options`, CSP
- [x] Login / logout (Turnstile + cookie session)
- [ ] Password reset hash exchange (manual)
- [ ] Crop tool + billing checkout (non-admin test account)
- [ ] Admin review page; reviewer DTO hides `user_id`

---

## Phase 2B — CSP enforcement ✅

- Switched nginx from `Content-Security-Policy-Report-Only` → **enforcing** `Content-Security-Policy` in `deploy/fly/nginx.conf` and `frontend/nginx.conf`.
- Added `form-action 'self' https://checkout.stripe.com` for Stripe Checkout redirects.
- Monitor browser console after deploy; tune policy if violations appear.

---

## Phase 2C — Auth hardening cleanup ✅

| Task | Status |
|------|--------|
| Remove `Authorization: Bearer` fallback on `/api` auth | Done — cookie-only in `auth.ts` |
| Move profile read/write to `/api/me/profile` BFF | Done — `AccountPage` migrated |
| Share token + CSRF unit tests | Done — extended `security.test.ts` |
| Document session invalidation on password change | Done — `docs/security.md` |

---

## Phase 2D — Rate limit hygiene ✅

| Task | Status |
|------|--------|
| Scheduled cleanup of expired `rate_limit_buckets` rows | Done — pg_cron hourly (`20260625180000_rate_limit_buckets_prune.sql`) |
| Log 429 rate-limit events | Done — structured `console.warn` in `rateLimit.ts` |
| Load test nginx + Postgres store | Optional — deferred |

---

## Phase 2E — Human pre-grade product

| Task | Status |
|------|--------|
| Implement share API (`GET /api/human-pregrades/share/:token`) | Done |
| Frontend share link UI | Pending |
| Enable `HUMAN_PREGRADE_ENABLED=1` + Stripe price on Fly | **Ops** — not enabled by default |
| Staff onboarding in `human_pregrade_staff` | **Ops** — manual |

---

## Phase 2F — PR / release structure ✅

Security remediation shipped as a **single release** on `main` (not split into 8 PRs). Acceptable for solo/small-team velocity.

---

## Environment reference

| Variable | Local (`.env`) | Fly |
|----------|----------------|-----|
| `CSRF_SECRET` | Set | Secret |
| `SUPABASE_PUBLISHABLE_KEY` | Set | Secret |
| `SUPABASE_SERVICE_ROLE_KEY` | Set | Secret |
| `HUMAN_PREGRADE_RATE_LIMIT_STORE` | `memory` | `postgres` |
| `TRUST_PROXY_HOPS` | `1` | `1` |

---

## Success criteria

| Criterion | Status |
|-----------|--------|
| Cookie auth + CSRF on production | Done |
| CSP enforcing | Done (deploy required) |
| Postgres rate limits + cleanup job | Done |
| Bearer fallback removed on `/api` | Done |
| Share API live | Done (feature-flagged off until `HUMAN_PREGRADE_ENABLED=1`) |

---

## Remaining ops (optional)

1. **`fly deploy`** — ship Phase 2B–2E code changes.
2. **Enable human pre-grade** — set `HUMAN_PREGRADE_ENABLED=1` and `STRIPE_HUMAN_PREGRADE_PRICE` on Fly when ready to launch.
3. **Share link UI** — add “Copy share link” on customer report page after publish.
4. **Manual billing smoke** — use a non-admin account (admins cannot checkout by design).
