# GemCheck Collector Profiles

Standalone vertical module for public collector identity, card listings, trade enquiries, messaging, grading integration, and moderation.

## Module boundary

- Backend: [`backend/src/collectorProfiles/`](../backend/src/collectorProfiles/)
- Frontend: [`frontend/src/collectorProfiles/`](../frontend/src/collectorProfiles/)
- Migration: [`supabase/migrations/20260628120000_collector_profiles_schema.sql`](../supabase/migrations/20260628120000_collector_profiles_schema.sql)

Integrates with existing systems **only through adapters** — no changes to grading pipeline, crop engine, billing core, or auth.

## Feature flags

| Layer | Control |
|-------|---------|
| Env | `COLLECTOR_PROFILES_ENABLED=1` |
| DB | `collector_profile_settings.collector_profiles_enabled` |
| Sub-flags | messaging, grading, discovery, trade enquiries |

When disabled: customer/public API returns 404; data is retained; admin may still access with env + permissions.

## Routes

### Public web

- `/u/:username` — public profile
- `/u/:username/cards/:publicCardId` — public card

### Customer (authenticated)

- `/collector/setup`, `/collector/profile`, `/collector/cards`, `/collector/messages`, `/collector/trades`, `/collector/settings`

### Admin

- `/admin/collector/profiles`, `/admin/collector/reports`, `/admin/collector/moderation-cases`, `/admin/collector/settings`, etc.

### API

- Customer: `/api/collector/*`
- Admin: `/api/admin/collector/*`
- Public discovery: `GET /api/collector/discover?q=` (optional auth; IP rate-limited; requires discovery sub-flag)

## Existing files modified (additive)

| File | Reason |
|------|--------|
| `backend/src/index.ts` | Mount collector routers |
| `backend/src/routes/billing.ts` | Stripe webhook branch `collector_profile_grade` |
| `frontend/src/App.tsx` | Register routes |
| `frontend/src/components/admin/AdminNav.tsx` | Admin nav link |
| `frontend/src/components/header/AppNavLinks.tsx` | Customer nav link |

## Environment variables

```bash
COLLECTOR_PROFILES_ENABLED=0
COLLECTOR_PROFILE_USERNAME_REDIRECT_DAYS=90
# Uses existing R2_*, STRIPE_*, SUPABASE_*
```

## Rollback

1. Disable in admin settings (`collector_profiles_enabled=false`)
2. Set `COLLECTOR_PROFILES_ENABLED=0` on Fly
3. Migrations are forward-only; no data deletion

## Known limitations (v1)

- Messaging uses REST polling (no WebSocket/Supabase Realtime)
- No follow/save, group chat, escrow, or grade transfer to owner
- Email notifications only (no in-app notification centre)

## Flows

- **Profile**: create username → settings → publish → share `/u/username`
- **Card (upload-first wizard)**: add card → upload front → GemCheck crop (shared daily quota on confirm) → rich autofill → edit metadata → upload/crop back → sections → publish
- **Crop quota**: `POST .../process` is preview-only (no quota). `POST .../crop/:role` with confirm bills the same daily allowance as `POST /api/process` (`FREE_DAILY_LIMIT = 3` on free plan). Re-confirming the same side does not double-charge (`crop_usage_counted`).
- **Identification**: `POST /api/collector/cards/:publicCardId/identify` runs after front crop confirm; back only fills gaps when front confidence &lt; 0.75.
- **Display security**: public JSON returns HMAC proxy paths (`GET /api/collector/display/:publicCardId/:role?size=display|thumb&t=&exp=`). Set `COLLECTOR_DISPLAY_HMAC_SECRET` in production (required). Full-res processed PNGs are never presigned to browsers.
- **Owner grading**: entitlement adapter → `executeGrade` → grade link (private until owner publishes)
- **Viewer grading**: public derivatives only; result private to viewer; disclaimer shown
- **Trade enquiry**: structured offer → conversation created

## Card wizard API (customer)

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/collector/cards` | Create draft (`ownership_type`, optional `sections`) |
| POST | `/api/collector/cards/:id/images` | Upload original (`role=front\|back`) |
| POST | `/api/collector/cards/:id/process` | Detect + preview only; returns `previewBase64`, `editImageJpeg`, `metadata` |
| POST | `/api/collector/cards/:id/crop/front\|back` | Billable confirm; stores master PNG + display/thumb JPEG |
| POST | `/api/collector/cards/:id/identify` | Rich vision autofill (`role`, optional `force`) |
| PATCH | `/api/collector/cards/:id` | Partial metadata + sections |
| POST | `/api/collector/cards/:id/publish` | Requires confirmed front+back for owned cards |

## Migrations

- [`20260628120000_collector_profiles_schema.sql`](../supabase/migrations/20260628120000_collector_profiles_schema.sql) — base schema
- [`20260628200000_collector_card_identify_display.sql`](../supabase/migrations/20260628200000_collector_card_identify_display.sql) — identification columns, `display_storage_id`, `crop_usage_counted`
- **Moderation**: report → case → audited admin conversation access → visible admin join
