# Additive edits to existing files

| File | Why |
|------|-----|
| `backend/src/index.ts` | Mount human-pregrade customer + admin routers |
| `backend/src/routes/billing.ts` | Delegate `human_pregrade` Stripe webhook to module handler |
| `backend/src/lib/stripe.ts` | Export `HUMAN_PREGRADE_PRICE` constant |
| `.env.example` | Document new env vars |
| `frontend/src/App.tsx` | Customer + admin routes |
| `frontend/src/components/admin/AdminNav.tsx` | Queue nav link (gated) |
| `frontend/src/pages/GradePage.tsx` | Expert Review CTA |
| `frontend/src/pages/AccountPage.tsx` | Expert Reviews section |
| `frontend/src/pages/PricingPage.tsx` | Service card |
| `frontend/package.json` | Vitest for module tests |

No changes to AI grading, grade routes, or existing payment internals beyond one webhook branch.
