# Security architecture

Overview of authentication, CORS, CSRF, and API boundaries for PokeCrop / GemCheck.

## Web application auth (BFF + HttpOnly cookies)

The browser **does not** persist Supabase JWTs in `localStorage`. Instead:

1. The SPA calls `/api/auth/*` routes on the Express backend.
2. On login/signup/exchange, the backend sets HttpOnly cookies:
   - `gc_access` — short-lived access token
   - `gc_refresh` — refresh token
3. Mutating `/api` requests send `credentials: 'include'` and an `X-CSRF-Token` header matching the readable `gc_csrf` cookie (double-submit).
4. `backend/src/middleware/auth.ts` reads `gc_access` only (cookie session). `/v1` API keys use separate middleware — not Bearer on `/api`.

Cookie flags: `HttpOnly` (access/refresh), `SameSite=Lax`, `Secure` in production (or when `SESSION_COOKIE_SECURE=1`), path `/`.

CSRF is enforced on POST/PUT/PATCH/DELETE under `/api`, except auth bootstrap routes (`/auth/login`, `/auth/signup`, `/auth/password-reset`, `/auth/exchange`) and Stripe webhooks.

### Session invalidation

- **Logout:** `POST /api/auth/logout` clears `gc_access`, `gc_refresh`, and `gc_csrf` cookies and calls Supabase signOut.
- **Password change:** `POST /api/auth/password-update` rotates session cookies with new tokens after `updateUser({ password })`.
- **Expired refresh:** `POST /api/auth/refresh` failure clears session cookies; client should redirect to login.

Profile read/write uses `GET/PATCH /api/me/profile` (service-role backend) — not direct Supabase client access from the browser.

Environment:

| Variable | Purpose |
|----------|---------|
| `SUPABASE_PUBLISHABLE_KEY` | Server-side anon client for auth BFF |
| `CSRF_SECRET` | HMAC secret for CSRF token signing |
| `SESSION_COOKIE_SECURE` | Force `Secure` cookies in non-TLS dev |
| `TRUST_PROXY_HOPS` | Express `trust proxy` hop count behind nginx |
| `BETA_INVITE_REQUIRED` | When `true`, signup requires a valid invite token |
| `SUPABASE_ACCESS_TOKEN` | Personal access token (`auth:write`) — Ops toggle syncs `disable_signup` to Supabase |
| `SUPABASE_PROJECT_REF` | Optional; inferred from `SUPABASE_URL` if omitted |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Mailgun SMTP for admin beta invite emails (not API keys) |

## Beta invites

When `BETA_INVITE_REQUIRED=true`, `POST /api/auth/signup` requires `inviteToken` matching a row in `public.invites`. Admins send invites via `POST /api/admin/invites` (SMTP must be configured). First admin is still bootstrapped manually; subsequent admins can be invited with `role=admin`.

**Supabase direct signups:** The admin Ops toggle (`PATCH /admin/beta/settings`) writes `app_settings.invite_required` and, when `SUPABASE_ACCESS_TOKEN` is set, PATCHes Supabase Auth `disable_signup` via the [Management API](https://supabase.com/docs/reference/api/introduction). That blocks callers from bypassing the BFF with the publishable key. Create a token at [Supabase account tokens](https://supabase.com/dashboard/account/tokens) with auth config write scope, then:

```bash
fly secrets set -a pokecrop SUPABASE_ACCESS_TOKEN='sbp_...'
```

Without the token, the app gate still applies; only the Supabase-layer bypass remains open until the token is set and the toggle is flipped (or you disable signups manually in the dashboard).

Public invite validation uses `POST /api/auth/invite/validate` (rate-limited, token in body — not URL). Login consumes pending invites on first sign-in after email confirmation.

## Public REST API (`/v1`)

Machine clients use **API keys** via `Authorization: Bearer pk_…` or `X-API-Key`. This surface intentionally uses **open CORS** (`origin: true`) so integrations from any origin can call the API.

**Important:** `/v1` does **not** use cookie session auth. Do not add cookie-based auth to `/v1` without revisiting CORS and CSRF policy.

Rate limits: `API_RATE_PER_MIN`, `API_DAILY_SOFT_CAP`, etc. (see `.env.example`).

## Rate limits

Application rate limits use a pluggable store backed by Postgres in production:

- `RATE_LIMIT_STORE=memory` — default for local dev/CI
- `RATE_LIMIT_STORE=postgres` — shared buckets in `rate_limit_buckets` (survives restarts and horizontal scale)
- `HUMAN_PREGRADE_RATE_LIMIT_STORE` — legacy alias for the same setting

**Web app (`/api`, session auth)** — per-user limits (defaults per minute):

| Env | Default | Route |
|-----|---------|-------|
| `WEB_CROP_UPLOAD_PER_MIN` | 20 | `POST /upload` |
| `WEB_CROP_PROCESS_PER_MIN` | 40 | `POST /process` |
| `WEB_GRADE_PER_MIN` | 6 | `POST /grade` |
| `WEB_GRADE_STRAIGHTEN_PER_MIN` | 30 | `POST /grade/straighten` |
| `WEB_CENTERING_PREVIEW_PER_MIN` | 120 | `POST /grade/centering-preview` |

**Public API (`/v1`, API key)** — per-account limits use the same Postgres store (`API_RATE_PER_MIN`, `API_STRAIGHTEN_RATE_PER_MIN`, `API_DAILY_SOFT_CAP`, `API_GRADE_PER_MIN`, `API_CENTERING_PREVIEW_PER_MIN`).

## Human Pre-Grade rate limits

Application rate limits for authenticated human-pregrade actions use `humanPregradeRateLimit()` with the shared store above:

- `HUMAN_PREGRADE_RATE_LIMIT_STORE=memory` — default for local dev/CI
- `HUMAN_PREGRADE_RATE_LIMIT_STORE=postgres` — shared buckets in `rate_limit_buckets` for production

nginx adds belt-and-suspenders `limit_req` on upload/checkout paths (see `deploy/fly/nginx.conf`).

## HTTP security headers

- **nginx** sets `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and **enforcing `Content-Security-Policy`** for the SPA.
- **Express** uses `helmet()` with CSP disabled (nginx owns HTML CSP); API responses get `noSniff` and frameguard.

## Database access model

Human pre-grade tables use RLS enabled with **no client policies** — all access goes through the service-role backend. See `docs/human-pregrade/schema.md`.

## Related documents

- `security_best_practices_report.md` — audit findings and remediation status
- `docs/human-pregrade/share-api.md` — public share endpoint (`GET /api/human-pregrades/share/:token`)
