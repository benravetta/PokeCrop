# API endpoints

## Customer — `/api/human-pregrades`

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/config` | Feature flag + product settings |
| POST | `/` | Create draft order |
| GET | `/` | List own orders (`?q=&status=&page=&pageSize=&sort=`) |
| GET | `/:publicId` | Order detail + images + open image requests |
| PATCH | `/:publicId/draft` | Update draft |
| POST | `/:publicId/images` | Upload / link image |
| DELETE | `/:publicId/images/:imageId` | Remove draft image |
| POST | `/:publicId/checkout` | Stripe Checkout |
| POST | `/:publicId/submit` | Submit for review |
| GET | `/:publicId/status` | Status + `progress` object |
| GET | `/:publicId/timeline` | Customer-visible status events |
| GET | `/:publicId/messages` | Messages |
| POST | `/:publicId/messages` | Customer message |
| POST | `/:publicId/image-requests/:requestId/fulfil` | Fulfil image request |
| GET | `/:publicId/report` | Published report JSON |
| GET | `/:publicId/report/pdf` | Download PDF (auth required) |
| POST | `/:publicId/report/share` | Enable sharing |
| DELETE | `/:publicId/report/share` | Disable sharing |

List response includes `progress: { step, totalSteps, label, percentComplete, isBranch, ... }` on each order.

## Admin — `/api/admin/human-pregrades`

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | Queue list |
| GET | `/:id` | Order + images + assessment + predictions + defects |
| GET | `/:id/report-preview` | QA HTML preview (no publish) |
| POST | `/:id/assign` | Assign reviewer |
| POST | `/:id/start` | Start review |
| POST | `/:id/request-images` | Request additional images |
| PUT | `/:id/assessment` | Save assessment draft |
| PUT | `/:id/grader-predictions` | Save grader predictions |
| POST | `/:id/defects` | Add defect |
| POST | `/:id/submit-for-check` | Submit for QA |
| POST | `/:id/approve` | Approve + publish report |
| POST | `/:id/return` | Return to reviewer |
| GET/PUT | `/settings` | Product settings |

See implementation in `backend/src/humanPregrade/api/adminRoutes.ts`.
