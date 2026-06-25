# GemCheck Expert Review (Human Pre-Grade)

Standalone human expert pre-grading pipeline. Isolated from AI grading.

## Feature flag

- Env: `HUMAN_PREGRADE_ENABLED=1` (default off)
- DB: `human_pregrade_settings.enabled`
- Admin users retain access when env is off (ops console)

## Environment variables

| Variable | Purpose |
|----------|---------|
| `HUMAN_PREGRADE_ENABLED` | Server-side gate (`1` = on) |
| `STRIPE_HUMAN_PREGRADE_PRICE` | Stripe one-time price ID for Expert Review |

## Rollback

1. Set `HUMAN_PREGRADE_ENABLED=0`
2. Set `human_pregrade_settings.enabled = false` via admin settings
3. Existing orders and reports remain in dedicated tables

## Known limitations

- Email notifications deferred to Phase 2 (hook points: `notificationAdapter.ts` on steps 5 and 7)
- AI report link reads `usage_events` summary; optional client snapshot stored on order
- Grade session images are not persisted; reuse via crop catalog only

See also: [schema.md](./schema.md), [status-diagram.md](./status-diagram.md), [api.md](./api.md), [edited-files.md](./edited-files.md).
