# Human Pre-Grade public share API (specification)

This document describes the **planned** public share endpoint for published human pre-grade reports. No route is implemented yet; use this spec when building the feature.

## Purpose

Allow a customer to share a read-only view of a completed report via an unguessable token, without exposing internal IDs, staff data, or draft content.

## Endpoint (planned)

```
GET /api/human-pregrades/share/:publicToken
```

Unauthenticated. Rate limited per IP (reuse human-pregrade rate limit infrastructure).

## Token lookup rules

1. Resolve `publicToken` against `human_pregrade_reports.public_token` (or dedicated share table if split later).
2. Compare using a **constant-time** equality check on normalized tokens (same length, `timingSafeEqual`).
3. Reject missing, malformed, or non-UUID tokens with `404` (do not distinguish “unknown token” from “not shareable”).
4. Join to the parent order and report row; require:
   - Order status is `completed` (or equivalent published state).
   - Report row exists and `is_shareable = true`.
   - Report `published_at` is not null.

## Response DTO (sanitized)

Return the same customer-safe shape as the authenticated customer report endpoint:

- Use `sanitizeCustomerReport()` from `backend/src/humanPregrade/api/security.ts`.
- **Exclude:** `public_token`, `html_snapshot`, internal user IDs, payment metadata, staff assignment, raw AI snapshot, audit fields.
- **Include:** `reportData`, template/disclaimer versions, `publishedAt`, `hasPdf`, `isShareable`.

Optional: signed URL for PDF download with short TTL if `hasPdf` is true (separate endpoint).

## Abuse controls

| Control | Notes |
|---------|--------|
| Rate limit | Per-IP bucket (e.g. 60/min); Postgres store in production |
| Token entropy | UUID v4 minimum; never sequential IDs |
| Constant-time compare | Prevent token enumeration timing leaks |
| No listing | No search or enumerate endpoint |
| CSP / headers | nginx CSP report-only → enforce before shipping embeddable HTML |

## Error responses

| Condition | HTTP | Body |
|-----------|------|------|
| Invalid token format | 404 | Generic “Not found” |
| Valid token but not shareable | 404 | Same as unknown |
| Rate limited | 429 | “Too many requests” |

## Implementation checklist

- [x] Migration: `public_token` indexed uniquely on `human_pregrade_reports`
- [x] Route + IP rate limit middleware (`GET /api/human-pregrades/share/:token`)
- [x] Unit tests: constant-time compare, token format validation
- [ ] Frontend share link UI (copy URL only after publish)
- [x] CSP enforcing before public share links
