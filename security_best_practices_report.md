# Security Best Practices Report — PokeCrop / Human Expert Pre-Grade

**Date:** 2026-06-23  
**Scope:** Full-stack audit with emphasis on the Human Expert Pre-Grade (`humanPregrade`) module and shared Express/React infrastructure  
**References:** `javascript-express-web-server-security.md`, `javascript-typescript-react-web-frontend-security.md`, `javascript-general-web-frontend-security.md`

---

## Executive Summary

PokeCrop’s Human Expert Pre-Grade pipeline was recently hardened with meaningful controls: Bearer-token auth (CSRF not applicable), reviewer assignment guards, Stripe webhook validation, customer report sanitization, settings whitelisting, separation-of-duties on QA approve, upload MIME sniffing, and AI snapshot size caps. **No Critical, immediately exploitable vulnerabilities were found in the current codebase** after that pass.

Remaining gaps are mostly **production hardening and defense-in-depth**: missing HTTP security headers, non-distributed rate limiting, a few input-validation holes, and minor API data exposure. The highest-priority follow-ups are adding security headers at nginx/Express, moving rate limits to a shared store, tightening message and image-request validation, and validating Stripe redirect URLs on the client.

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Backend | TypeScript, Node.js 20+, Express 4.21 |
| Frontend | TypeScript, React (Vite), React Router |
| Database | Supabase (PostgreSQL), RLS enabled |
| Auth | Supabase via BFF — HttpOnly cookies (`gc_access` / `gc_refresh`) + CSRF on mutating `/api` routes |
| Payments | Stripe Checkout + webhooks |
| Object storage | Cloudflare R2 |
| Edge / deploy | nginx reverse proxy (Fly.io) |

---

## Positive Controls Already in Place

| Area | Evidence |
|------|----------|
| Non-guessable public IDs | `public_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid()` in migration |
| IDOR protection (customer) | `loadOwnedOrder()` compares `order.user_id` to authenticated user |
| Reviewer assignment guards | `assertAssignedReviewer()` on mutating reviewer routes |
| Payment integrity | Webhook validates user, session, amount, currency, status (`paymentAdapter.ts`) |
| Report data minimization | `sanitizeCustomerReport()` strips `public_token`, HTML snapshot, internal IDs |
| Settings mass-assignment | `SETTINGS_PATCH_KEYS` whitelist in `settingsRepo.ts` |
| Upload safety | MIME sniffing, size limits, server-side UUID keys in R2 |
| HTML report XSS | `esc()` used throughout `renderReportHtml()` |
| Search injection mitigation | `sanitizeOrderSearchQuery()` strips PostgREST metacharacters |
| SoD on QA approve | Reviewer cannot approve own assessment (non-admin) |

---

## Critical Findings

*None identified in the current deployed code paths.*

---

## High Findings

### Finding 1 — Missing HTTP security headers (EXPRESS-HEADERS-001 / REACT-HEADERS-001)

**Severity:** High (defense-in-depth; elevated if XSS is ever introduced)

**Location:** `backend/src/index.ts` (no `helmet()`); `deploy/fly/nginx.conf` lines 1–52 (no `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options` / `frame-ancestors`, `Referrer-Policy`)

**Evidence:**

```19:47:backend/src/index.ts
const app = express();
// ... no helmet(), no app.disable('x-powered-by')
app.use("/api", webCors);
app.use(express.json({ limit: "1mb" }));
```

```1:52:deploy/fly/nginx.conf
server {
    listen 8080;
    // ... no add_header Content-Security-Policy / X-Frame-Options / etc.
}
```

**Impact:** Without CSP and related headers, any future XSS flaw (stored message HTML, third-party script, compromised dependency) has a larger blast radius; clickjacking and MIME-sniffing attacks are easier.

**Fix:** Add `helmet()` (or equivalent) on Express and/or set headers in nginx. Start with a report-only CSP, then enforce. Prefer `frame-ancestors 'self'` unless embedding is required.

**Mitigation:** Strict React escaping-by-default; no `dangerouslySetInnerHTML` in human-pregrade UI.

**False positive notes:** Headers may exist on a CDN not visible in this repo — verify at runtime with `curl -I`.

---

### Finding 2 — In-memory rate limits do not survive restarts or scale horizontally (EXPRESS-AUTH-001 / EXPRESS-DOS-001)

**Severity:** High in multi-instance production

**Location:** `backend/src/humanPregrade/api/rateLimit.ts` lines 3–27

**Evidence:**

```3:27:backend/src/humanPregrade/api/rateLimit.ts
const WINDOW_MS = 60_000;
const buckets = new Map<string, { start: number; count: number }>();
// ... per-process Map, no Redis/shared store
```

**Impact:** Attackers can bypass per-user limits by hitting different app instances, or exhaust limits after each deploy/restart; upload/checkout/message abuse remains possible at scale.

**Fix:** Use Redis, Upstash, or edge rate limiting (Cloudflare/Fly) keyed by user ID + action. Keep application-level limits as a second layer.

**Mitigation:** nginx `limit_req` for `/api/human-pregrades/*` upload routes.

---

### Finding 3 — Customer messages API lacks size limits and over-fetches columns (EXPRESS-INPUT-001 / EXPRESS-BODY-001)

**Severity:** High (storage/DoS); Medium (data exposure)

**Location:** `backend/src/humanPregrade/api/customerRoutes.ts` lines 433–468

**Evidence:**

```433:468:backend/src/humanPregrade/api/customerRoutes.ts
      const { data } = await getServiceClient()
        .from("human_pregrade_messages")
        .select("*")
        .eq("order_id", order.id)
        .eq("customer_visible", true)
        // ...
      const body = String(req.body?.body ?? "").trim();
      if (!body) return res.status(400).json({ error: "Message required." });
      // no max length check
```

**Impact:** A customer can POST multi-megabyte messages repeatedly (rate limit is 20/min but each message can be huge), inflating DB storage and response payloads. `select("*")` returns internal columns (`sender_id`, `message_type`, `action_required`) to the client unnecessarily.

**Fix:** Cap body length (e.g. 4–8 KB), return an explicit column list (`id, body, created_at, sender_type`), and consider pagination on GET.

---

### Finding 4 — Stripe checkout redirect not validated on the client (REACT-URL-001)

**Severity:** High if the checkout API response is ever attacker-influenced; Medium under normal operation

**Location:** `frontend/src/humanPregrade/pages/HumanPregradeNewPage.tsx` lines 74–75

**Evidence:**

```74:75:frontend/src/humanPregrade/pages/HumanPregradeNewPage.tsx
    const { url } = await startHumanPregradeCheckout(id);
    window.location.href = url;
```

**Impact:** If the backend were compromised or a MITM injected a malicious `url`, the browser would navigate to an arbitrary origin (phishing / token theft on a fake checkout page).

**Fix:** Parse `url` with `new URL()` and allowlist hostnames (`checkout.stripe.com`, optionally `billing.stripe.com`). Fall back to an error state if validation fails.

---

## Medium Findings

### Finding 5 — Image request `requiredImageType` not allowlisted (EXPRESS-INPUT-001)

**Severity:** Medium

**Location:** `backend/src/humanPregrade/api/adminRoutes.ts` lines 242–251; fulfil path `customerRoutes.ts` line 497 uses stored type without re-validation

**Evidence:**

```242:251:backend/src/humanPregrade/api/adminRoutes.ts
      const requiredImageType = String(req.body?.requiredImageType ?? "back");
      // ... inserted without assertValidImageType()
```

**Impact:** Reviewers can store arbitrary strings as `required_image_type`. On fulfil, `uploadHumanPregradeImage` uses that value as `imageType` without calling `assertValidImageType()`, bypassing the upload type allowlist and potentially polluting image metadata.

**Fix:** Wrap with `assertValidImageType(requiredImageType)` on create and on fulfil.

---

### Finding 6 — `primary_grader_id` on order create not validated (EXPRESS-INPUT-001)

**Severity:** Medium

**Location:** `backend/src/humanPregrade/api/customerRoutes.ts` line 149

**Evidence:**

```149:149:backend/src/humanPregrade/api/customerRoutes.ts
        primary_grader_id: body.primaryGraderId ?? null,
```

**Impact:** Customers can reference disabled or non-existent grader UUIDs (FK may fail) or attach unexpected grader IDs to orders; inconsistent with `selectedGraderIds` which uses `validateGraderIds()`.

**Fix:** If `primaryGraderId` is provided, run `validateGraderIds([id])` before insert.

---

### Finding 7 — Supabase session persisted in browser storage (REACT-AUTH-001)

**Severity:** Medium (project-wide)

**Location:** `frontend/src/lib/supabase.ts` lines 20–28

**Evidence:**

```20:28:frontend/src/lib/supabase.ts
export const supabase = createClient(url ?? "http://localhost", publishableKey ?? "public-anon-key", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
  },
});
```

**Impact:** Supabase stores refresh/access tokens in `localStorage` by default. Any XSS anywhere in the SPA can exfiltrate session tokens and impersonate users.

**Fix:** Prefer HttpOnly cookie session via Supabase SSR/BFF pattern, or accept risk with strict CSP + minimal XSS surface. Short-lived tokens and aggressive CSP are compensating controls.

**False positive notes:** Bearer-header API calls are not CSRF-vulnerable; this finding is XSS/token-exfiltration focused.

---

### Finding 8 — Report preview iframe uses `srcDoc` without sandbox (REACT-XSS-001 / JS-XSS-001)

**Severity:** Medium (defense-in-depth)

**Location:** `frontend/src/humanPregrade/admin/AdminHumanPregradeReviewPage.tsx` line 520

**Evidence:**

```517:520:frontend/src/humanPregrade/admin/AdminHumanPregradeReviewPage.tsx
      {previewHtml ? (
        // ...
          <iframe title="Report preview" srcDoc={previewHtml} className="w-full h-[480px] bg-white" />
```

**Impact:** Server HTML is escaped via `esc()`, but a future regression in `renderReportHtml()` would execute script in an iframe context adjacent to the admin app.

**Fix:** Add `sandbox=""` (or `sandbox="allow-same-origin"` if styling requires) and keep `esc()` centralized. Consider rendering preview as React components instead of raw HTML.

---

### Finding 9 — Shareable reports: token generated, no public access route yet (design risk)

**Severity:** Medium (future)

**Location:** `backend/src/humanPregrade/application/reportPublisher.ts` lines 73–81; customer share toggle `customerRoutes.ts` lines 588–623

**Evidence:** `public_token` UUID is stored and `is_shareable` can be toggled, but no unauthenticated `/share/:token` route exists in the codebase.

**Impact:** When a public share endpoint is added, incorrect authorization (e.g. exposing reports when `is_shareable` is false, or enumerable tokens) would leak expert review data.

**Fix:** Before shipping share URLs: require `is_shareable === true`, use constant-time token lookup, rate-limit public endpoint, never return `public_token` in customer JSON (already sanitized).

---

### Finding 10 — Admin order detail returns full internal row to API callers (data exposure)

**Severity:** Medium (insider / over-privileged staff)

**Location:** `backend/src/humanPregrade/api/adminRoutes.ts` lines 135–145

**Evidence:**

```135:145:backend/src/humanPregrade/api/adminRoutes.ts
    res.json({
      order,
      images: enriched,
      assignment,
      aiAnalysis,
      assessment,
      // ... full order includes user_id, ai_report_snapshot, customer_notes, etc.
    });
```

**Impact:** Any user with `human_pregrade.admin.view_all` receives full PII and internal snapshots. Acceptable for admins; risky if that permission is granted broadly to reviewers.

**Fix:** Return a sanitized admin DTO by role (reviewer vs admin), or split permissions so reviewers use `view_assigned` with field filtering.

---

### Finding 11 — ILIKE search wildcards not neutralized (EXPRESS-INPUT-001)

**Severity:** Medium (performance / logic abuse, low confidentiality impact)

**Location:** `backend/src/humanPregrade/api/security.ts` lines 9–15; `orderRepo.ts` lines 70–74

**Evidence:** `sanitizeOrderSearchQuery` strips PostgREST metacharacters but not `%` or `_`, which are ILIKE wildcards.

**Impact:** Customers can craft searches matching all orders (`%`) within their own data; mostly a performance/query-broadening issue, not cross-user access.

**Fix:** Escape `%` and `_` for ILIKE (e.g. replace with `\%`) or reject queries containing them.

---

### Finding 12 — RLS enabled with no policies on human_pregrade tables

**Severity:** Medium (informational / architecture)

**Location:** `supabase/migrations/20260625120000_human_pregrade_schema.sql` lines 356–372

**Evidence:** `ENABLE ROW LEVEL SECURITY` with no `CREATE POLICY` statements in the migration.

**Impact:** Direct Supabase client access with the anon key is **denied by default** (good). All access goes through the service-role backend (good if service key is protected). If policies are added later without care, misconfiguration could expose tables.

**Fix:** Document intentional “service-role only” access in `docs/human-pregrade/schema.md`. Optionally add explicit `DENY ALL` policies for clarity, or add least-privilege policies if direct client access is ever needed.

---

## Low Findings

### Finding 13 — No `trust proxy` configuration (EXPRESS-PROXY-001)

**Location:** `backend/src/index.ts` — no `app.set('trust proxy', ...)`

**Impact:** `req.ip` in audit logs (`adminRoutes.ts` line 44) may reflect proxy incorrectly if Express is ever exposed without nginx, or if forwarded headers are spoofed without proper proxy trust configuration.

**Fix:** Set `trust proxy` to match Fly/nginx topology (hop count or CIDR).

---

### Finding 14 — Express fingerprinting not reduced (EXPRESS-FINGERPRINT-001)

**Location:** `backend/src/index.ts` — default `X-Powered-By: Express` likely present

**Fix:** `app.disable('x-powered-by')`.

---

### Finding 15 — Open CORS on `/v1` API (EXPRESS-CORS-001)

**Location:** `backend/src/index.ts` lines 27–32 — `origin: true` for machine API

**Impact:** Intentional for API-key clients. Ensure no cookie auth on `/v1` routes (currently uses API keys — OK).

---

### Finding 16 — Assessment/defect payloads lack field length and JSON size bounds

**Location:** `backend/src/humanPregrade/api/adminRoutes.ts` assessment PUT (lines 285–307), defects POST (lines 582–601)

**Impact:** Large text/JSON payloads could bloat DB rows; low risk with authenticated staff only.

**Fix:** Add reasonable max lengths and cap `geometry_data` JSON size.

---

## Recommended Remediation Order

All findings below have been addressed in code unless noted. See `docs/security.md` for the current auth and header model.

| Finding | Status | Notes |
|---------|--------|-------|
| 1 — Security headers | Done | nginx report-only CSP + Helmet on Express |
| 2 — Distributed rate limits | Done | Postgres `rate_limit_buckets` + nginx `limit_req` |
| 3 — Message limits/projection | Done | 4 KB cap, column projection, GET limit 100 |
| 4 — Stripe URL allowlist | Done | `safeStripeCheckoutUrl()` |
| 5 — Image type validation | Done | create + fulfil paths |
| 6 — Grader ID validation | Done | `validateGraderIds()` on create |
| 7 — Session storage / BFF | Done | HttpOnly cookies, CSRF, `/api/auth/*` |
| 8 — iframe sandbox | Done | Admin preview iframe `sandbox=""` |
| 9 — Public share API | Done | `GET /api/human-pregrades/share/:token` + IP rate limit |
| 10 — Admin DTO | Done | `sanitizeAdminOrder()` by role |
| 11 — ILIKE wildcards | Done | `%` / `_` stripped in search |
| 12 — RLS documentation | Done | `docs/human-pregrade/schema.md` |
| 13 — trust proxy | Done | `TRUST_PROXY_HOPS` |
| 14 — x-powered-by | Done | `app.disable('x-powered-by')` + Helmet |
| 15 — Open CORS on `/v1` | Documented | Intentional; no cookie auth on `/v1` |
| 16 — Field size caps | Done | `limits.ts` on assessment/defects |

---

## Test Coverage Notes

Security unit tests cover search sanitization, report/admin DTO sanitization, AI snapshot size, message length limits, image-type validation, CSRF middleware, and in-memory rate limit stores. Manual smoke: login/logout, human-pregrade checkout, admin review, CSP report-only console after deploy.

---

*Report generated per the Cursor `security-best-practices` skill. Remediation implemented 2026-06.*
