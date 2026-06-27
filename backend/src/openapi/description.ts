// Markdown intro rendered at the top of /docs (Scalar reads info.description).

export const API_DESCRIPTION = `
GemCheck is a Pokémon (and general TCG) **crop + AI pre-grade** service. The public REST API
exposes the same engines as the [web app](https://gemcheck.co.uk): detect and extract cards from
photos, then run a detailed condition report with per-company grade estimates, prep guidance, and
an optional **PDF report** identical to the web download.

**Base URL:** \`https://gemcheck.co.uk/v1\`

---

## Plans & access

| Plan | Price | API access |
|------|-------|------------|
| Free | £0 | No — web app only, 3 pre-grades/month |
| Premium | £9.99/mo | No — 30 pre-grades/month |
| Pro | £19.99/mo | No — 100 pre-grades/month |
| **Enterprise** | **£29.99/mo** | **Yes** — Pro + REST API, 100 pre-grades/month |

Subscribe on the [Pricing](/pricing) page, then create keys on [Account](/account).
Keys are shown **once** at creation (\`pk_live_…\`). Store them securely.

---

## Authentication

Send your key on every request (except \`/health\`, \`/version\`, \`/openapi.json\`):

\`\`\`http
Authorization: Bearer pk_live_xxxxxxxxxxxxxxxxxxxxxxxx
\`\`\`

Alternative header:

\`\`\`http
X-API-Key: pk_live_xxxxxxxxxxxxxxxxxxxxxxxx
\`\`\`

Invalid or revoked keys → \`401 unauthorized\`. Wrong plan → \`403 forbidden_plan\`.

---

## Quick start

### 1. Crop a card → transparent PNG

\`\`\`bash
curl -X POST https://gemcheck.co.uk/v1/crop \\
  -H "Authorization: Bearer $GEMCHECK_API_KEY" \\
  -H "Accept: image/png" \\
  -F "image=@scan.jpg" \\
  -o cropped.png
\`\`\`

JSON instead of PNG: omit \`Accept: image/png\` (default). You get
\`{ image_base64, metadata }\`.

### 2. Pre-grade a card → JSON report

\`\`\`bash
curl -X POST https://gemcheck.co.uk/v1/grade \\
  -H "Authorization: Bearer $GEMCHECK_API_KEY" \\
  -H "Idempotency-Key: grade-001" \\
  -F "front=@front.jpg" \\
  -F "back=@back.jpg" | jq '.result.submission_recommendation'
\`\`\`

### 3. Pre-grade → PDF report (same as web)

\`\`\`bash
curl -X POST "https://gemcheck.co.uk/v1/grade?format=pdf" \\
  -H "Authorization: Bearer $GEMCHECK_API_KEY" \\
  -H "Idempotency-Key: grade-001" \\
  -F "front=@front.jpg" \\
  -F "back=@back.jpg" \\
  -o report.pdf
\`\`\`

Also works with \`Accept: application/pdf\` or multipart field \`format=pdf\`.

---

## Endpoints overview

| Method | Path | Purpose |
|--------|------|---------|
| POST | \`/crop\` | Extract card → PNG |
| GET | \`/crop/limits\` | Crop rate limit + today's usage |
| POST | \`/grade\` | AI pre-grade → JSON or PDF |
| GET | \`/grade/quota\` | Grading allowance remaining |
| POST | \`/grade/straighten\` | Straighten one photo (centring helper) |
| POST | \`/grade/centering-preview\` | Preview measured centring (no quota burn) |
| GET | \`/account\` | Plan, quotas, key count |
| GET | \`/usage\` | Paginated API usage history |
| GET | \`/health\` | Health check (no auth) |
| GET | \`/version\` | API version (no auth) |

---

## Crop (\`POST /crop\`)

**Input** — one of:

| Method | Field | Notes |
|--------|-------|-------|
| Multipart | \`image\` | JPEG, PNG, WEBP, PDF, HEIC, DNG — max **50 MB** |
| JSON | \`image_url\` | Public http/https URL (SSRF-guarded) |
| JSON | \`image_base64\` | Raw base64 or data URL |

**Optional tuning** — JSON object \`params\` (multipart: stringified JSON in \`params\` field).
See **CropParams** schema. Notable fields:

- \`crop_padding\`, \`corner_radius\`, \`output_rotation\`, \`manual_corners\`
- \`grading_safe: true\` — perspective-correct crop without beautification (for grading)
- \`metadata_level\`: \`full\` (default) or \`minimal\`
- \`include_suitability\`: GPT pre-assessment hint (default \`true\`; set \`false\` to skip)

**Output**

- Default: \`application/json\` → \`{ image_base64, metadata }\`
- \`Accept: image/png\` → raw PNG bytes

**Usage counting:** Each **successful** crop counts towards rate limits. Failed detections do not.

---

## Grade (\`POST /grade\`)

**Multipart fields**

| Field | Required | Purpose |
|-------|----------|---------|
| \`front\` | Yes | Main card photo |
| \`back\` | No | Back photo (strongly recommended) |
| \`angled_front\`, \`angled_back\` | No | Glare / angle shots |
| \`closeups\` | No | Up to 6 defect close-ups |
| \`centering\` | No | JSON centring ratios: \`{"front":{"leftRight":"55/45","topBottom":"50/50"}}\` |
| \`format\` | No | \`json\` (default) or \`pdf\` |

**Response (JSON)**

\`\`\`json
{
  "result": { "... GradeResult — see schema ..." },
  "quota": { "plan": "api", "remaining": 19, "limit": 20, "window": "day", ... },
  "capture_quality": { "ok": true, "score": 0.92, "issues": [] }
}
\`\`\`

Key \`result\` fields: \`card_identification\`, \`company_estimates\` (Beckett rows may include \`bgs_tier\`), \`bgs_insight\`, \`submission_recommendation\`,
\`corners\`, \`edges\`, \`surface\`, \`centering\`, \`pricing\`, \`preparation\`, \`summary\`.

**PDF response:** Same request with \`format=pdf\`. Returns \`application/pdf\` attachment.
Include \`front\` (and \`back\` if available) in the multipart upload — images are embedded in the PDF.

**Quota:** Premium = **30 grades per UTC month**. Pro and Enterprise = **100/month**. Purchased one-off credits stack on top.
\`not_a_card\` responses do **not** consume quota.

**Idempotency:** Send \`Idempotency-Key: your-unique-id\` (8–128 chars, \`[A-Za-z0-9_-]\`).
Safe to retry on network errors — duplicate keys return the cached result without double-charging.
If a grade with the same key is still running, you get \`429\` with \`Retry-After\`.

---

## Rate limits

| Limit | Scope | Default | Applies to |
|-------|-------|---------|------------|
| Burst | Account | 60/min | Successful crops |
| Daily soft cap | Account | 5000/day | Successful crops |
| Straighten | Account | 30/min | Successful straighten calls |
| Grade quota | Account | 100/month (Pro/Enterprise) | Grades |

Response headers on crop (and straighten):

\`\`\`http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1719150000
\`\`\`

\`429 rate_limited\` includes \`Retry-After\` (seconds).

\`GET /crop/limits\` and \`GET /account\` expose \`crops_today\` (summed across all your API keys).

---

## Errors

All errors use a structured envelope:

\`\`\`json
{ "error": { "code": "invalid_request", "message": "Human-readable detail." } }
\`\`\`

Grade errors may also include \`quota\` or \`capture_quality\` at the top level.

| Code | HTTP | Meaning |
|------|------|---------|
| \`unauthorized\` | 401 | Missing/invalid/revoked API key |
| \`forbidden_plan\` | 403 | Not on API plan, or account suspended |
| \`invalid_request\` | 400 | Bad input |
| \`unsupported_media_type\` | 415 | File type not allowed |
| \`payload_too_large\` | 413 | Over 50 MB |
| \`unprocessable_image\` | 422 | No card detected (crop may include \`candidates_found\`) |
| \`capture_quality\` | 422 | Photos too poor to grade reliably |
| \`quota_exceeded\` | 429 | Daily/monthly grade limit hit |
| \`rate_limited\` | 429 | Crop/straighten burst or daily cap |
| \`processing_failed\` | 502 | Pipeline or grading error |
| \`not_configured\` | 503 | Server misconfiguration |
| \`internal_error\` | 500 | Unexpected error |

---

## Usage history

\`GET /usage\` returns paginated \`usage_events\` where \`source=api\` only (not web-app actions).

Query params: \`kind=crop|grade\`, \`q\` (search summary), \`from\`, \`to\`, \`page\`, \`pageSize\` (max 100).

---

## What's not in the API

These stay on the web app (session cookie auth):

- Interactive crop editor (re-process same upload for free)
- Billing / Stripe checkout
- API key create/revoke (use [Account](/account))
- Admin tools

---

## Support

Built by [Looky Collectibles](https://getlooky.uk). Questions: [gemcheck.co.uk](https://gemcheck.co.uk).
`;
