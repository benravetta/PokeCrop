# Security architecture

Overview of authentication, CORS, CSRF, and API boundaries for PokeCrop / GemCheck.

## Web application auth (BFF + HttpOnly cookies)

The browser **does not** persist Supabase JWTs in `localStorage`. Instead:

1. The SPA calls `/api/auth/*` routes on the Express backend.
2. On login/signup/exchange, the backend sets HttpOnly cookies:
   - `gc_access` — short-lived access token
   - `gc_refresh` — refresh token
3. Mutating `/api` requests send `credentials: 'include'` and an `X-CSRF-Token` header matching the readable `gc_csrf` cookie (double-submit).
4. `backend/src/middleware/auth.ts` reads `gc_access` first, then falls back to `Authorization: Bearer` for migration tooling.

Cookie flags: `HttpOnly` (access/refresh), `SameSite=Lax`, `Secure` in production (or when `SESSION_COOKIE_SECURE=1`), path `/`.

CSRF is enforced on POST/PUT/PATCH/DELETE under `/api`, except auth bootstrap routes (`/auth/login`, `/auth/signup`, `/auth/password-reset`, `/auth/exchange`) and Stripe webhooks.

Environment:

| Variable | Purpose |
|----------|---------|
| `SUPABASE_PUBLISHABLE_KEY` | Server-side anon client for auth BFF |
| `CSRF_SECRET` | HMAC secret for CSRF token signing |
| `SESSION_COOKIE_SECURE` | Force `Secure` cookies in non-TLS dev |
| `TRUST_PROXY_HOPS` | Express `trust proxy` hop count behind nginx |

## Public REST API (`/v1`)

Machine clients use **API keys** via `Authorization: Bearer pk_…` or `X-API-Key`. This surface intentionally uses **open CORS** (`origin: true`) so integrations from any origin can call the API.

**Important:** `/v1` does **not** use cookie session auth. Do not add cookie-based auth to `/v1` without revisiting CORS and CSRF policy.

Rate limits: `API_RATE_PER_MIN`, `API_DAILY_SOFT_CAP`, etc. (see `.env.example`).

## Human Pre-Grade rate limits

Application rate limits for authenticated human-pregrade actions use `humanPregradeRateLimit()` with a pluggable store:

- `HUMAN_PREGRADE_RATE_LIMIT_STORE=memory` — default for local dev/CI
- `HUMAN_PREGRADE_RATE_LIMIT_STORE=postgres` — shared buckets in `rate_limit_buckets` for production

nginx adds belt-and-suspenders `limit_req` on upload/checkout paths (see `deploy/fly/nginx.conf`).

## HTTP security headers

- **nginx** sets `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and **Content-Security-Policy-Report-Only** for the SPA.
- **Express** uses `helmet()` with CSP disabled (nginx owns HTML CSP); API responses get `noSniff` and frameguard.
- After a soak period with no CSP violations, switch nginx to enforcing `Content-Security-Policy`.

## Database access model

Human pre-grade tables use RLS enabled with **no client policies** — all access goes through the service-role backend. See `docs/human-pregrade/schema.md`.

## Related documents

- `security_best_practices_report.md` — audit findings and remediation status
- `docs/human-pregrade/share-api.md` — planned public share endpoint spec
