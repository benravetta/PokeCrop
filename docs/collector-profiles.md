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
- **Card**: upload front/back → auto crop → confirm crops → publish → assign sections
- **Owner grading**: entitlement adapter → `executeGrade` → grade link (private until owner publishes)
- **Viewer grading**: public derivatives only; result private to viewer; disclaimer shown
- **Trade enquiry**: structured offer → conversation created
- **Moderation**: report → case → audited admin conversation access → visible admin join
