# GemCheck

A [Looky Collectibles](https://getlooky.uk) tool — built with ❤️ in the English Lake District. Live at [gemcheck.co.uk](https://gemcheck.co.uk).

Web application for extracting trading cards from scans and photos. Upload an image or PDF, and CardCrop detects the frontmost card, preserves its exact border and rounded corners, removes the wrapper/backing card/background, and exports a transparent PNG.

Image processing runs entirely on your own server — no third-party image APIs. Accounts, login, usage limits and subscriptions are powered by [Supabase](https://supabase.com) (auth + Postgres) and [Stripe](https://stripe.com) (billing). See [Accounts, Billing & Admin](#accounts-billing--admin) for setup.

---

## Prerequisites

| Tool        | Minimum version | Check              |
|-------------|----------------|--------------------|
| **Node.js** | 20-24          | `node --version`   |
| **npm**     | 9+             | `npm --version`    |
| **Python**  | 3.9+           | `python3 --version`|

**macOS:** If you don't have Python 3.9+, install via `brew install python@3.11`.

CardCrop currently expects an LTS Node runtime. `Node 25` is not supported in this repo right now and can break the Vite/Rollup build. `./start.sh` will automatically try to use a compatible Node from `nvm` (`.nvmrc`) or Homebrew (`node@22` / `node@24`) if your default `node` is too new or too old.

**Windows:** Install Python from [python.org](https://www.python.org/downloads/) and ensure "Add to PATH" is checked during installation.

**Linux (Debian/Ubuntu):**
```bash
sudo apt update && sudo apt install python3 python3-venv python3-pip
```

---

## Quick Start

```bash
# Clone the repo
git clone https://github.com/benravetta/PokeCrop.git
cd PokeCrop

# One-command launch (installs deps on first run)
chmod +x start.sh
./start.sh
```

This will:
1. Create a Python virtual environment and install pip dependencies
2. Install Node.js dependencies for the backend and frontend
3. Start all three services

Once running, open **http://localhost:5173** in your browser.

---

## Production Deployment (Docker)

For production, CardCrop ships as three containers orchestrated with Docker Compose:

| Container  | Base image          | Role                                                        |
|------------|---------------------|-------------------------------------------------------------|
| `frontend` | `nginx:alpine`      | Serves the built SPA and reverse-proxies `/api` to backend  |
| `backend`  | `node:22-alpine`    | Express API gateway (bundled to a single self-contained file)|
| `python`   | `python:3.11-slim`  | FastAPI + OpenCV image-processing service                   |

Only the frontend is published to the host. The backend and Python service are
reachable only on the internal Docker network.

### Prerequisites

- Docker Engine 24+ and the Docker Compose plugin (`docker compose version`).

### Deploy

```bash
# 1. Configure (host port + public origin)
cp .env.example .env
#   edit .env as needed

# 2. Build and start
docker compose up -d --build

# 3. Check status / logs
docker compose ps
docker compose logs -f
```

The app is then available at the `PORT` from your `.env` (default
**http://localhost:8080**). Compose waits for each service's health check
before starting the next, so the stack is ready once `docker compose ps`
shows all three as `healthy`.

```bash
# Stop / remove
docker compose down

# Rebuild after code changes
docker compose up -d --build
```

### Configuration

All runtime config lives in `.env` (see `.env.example`):

| Variable            | Default                  | Purpose                                              |
|---------------------|--------------------------|------------------------------------------------------|
| `PORT`              | `8080`                   | Host port the app is published on                    |
| `PUBLIC_ORIGIN`     | `http://localhost:8080`  | Public origin (used for CORS)                        |
| `PYTHON_TIMEOUT_MS` | `180000`                 | Backend timeout waiting on the Python service        |
| `UVICORN_WORKERS`   | `1`                      | Python worker processes (scale with CPU cores / RAM) |

### Behind a domain / TLS

Terminate TLS at a reverse proxy (Caddy, Traefik, nginx, or a cloud load
balancer) in front of the `frontend` container, then point it at the published
`PORT`. Set `PUBLIC_ORIGIN=https://your-domain` in `.env`. The upload limit is
50 MB — if you add another proxy layer, give it a matching `client_max_body_size`
(or equivalent) and request timeouts of ~180s for the processing endpoint.

---

## Deploy to Fly.io

For a hosted deployment, CardCrop ships as a **single Fly.io machine** that runs
all three services (nginx + Node + Python) in one container, supervised by
`supervisord` and communicating over `localhost`. This keeps the app's in-memory
sessions coherent (no cross-instance state issues) and makes deploys a single
command.

The relevant files:

| File                          | Purpose                                            |
|-------------------------------|----------------------------------------------------|
| `Dockerfile.fly`              | Combined image (frontend + backend + python)       |
| `fly.toml`                    | Fly app config (port 8080, auto-HTTPS, 1 GB VM)    |
| `deploy/fly/nginx.conf`       | Serves the SPA, proxies `/api` to the local backend|
| `deploy/fly/supervisord.conf` | Runs and supervises the three processes            |

### Prerequisites

- A [Fly.io](https://fly.io) account.
- The Fly CLI: `brew install flyctl` (macOS) or see the
  [install docs](https://fly.io/docs/flyctl/install/).

### Deploy

```bash
# 1. Log in (opens your browser)
fly auth login

# 2. Build + deploy in one shot (single machine; uses the bundled config)
fly launch --copy-config --ha=false --now
```

`fly launch` reads `fly.toml` and `Dockerfile.fly`, builds the image on Fly's
remote builders (no local Docker required), and deploys. You'll be prompted to
choose a globally-unique **app name** and confirm the region. When it finishes
it prints your `*.fly.dev` URL.

**Custom domain.** Production is served at **[gemcheck.co.uk](https://gemcheck.co.uk)** (TLS cert issued via Fly). If you attach another hostname:

```bash
fly certs add gemcheck.co.uk
```

Then set `PUBLIC_ORIGIN=https://gemcheck.co.uk` and `CORS_ORIGIN=https://gemcheck.co.uk` (in `fly.toml` `[env]` or Fly secrets) and use that origin in Supabase redirect URLs, the Stripe webhook endpoint, etc.

### Updating / Continuous deployment

This app uses Fly's GitHub integration: **every push to `main` auto-deploys**
to Fly.io. So the normal workflow is just:

```bash
git push origin main
```

To deploy manually (e.g. without a commit), you can still run:

```bash
fly deploy
```

### Configuration

Settings live in `fly.toml` under `[env]` and `[[vm]]`:

| Setting                 | Default          | Notes                                                  |
|-------------------------|------------------|--------------------------------------------------------|
| `UVICORN_WORKERS`       | `1`              | Python workers (CPU-bound — scale with VM size)        |
| `PYTHON_TIMEOUT_MS`     | `180000`         | Backend timeout waiting on the Python service          |
| `[[vm]] memory`         | `1gb`            | OpenCV needs headroom; bump for large images           |
| `min_machines_running`  | `0`              | Scales to zero when idle (cheaper, but cold starts)    |

> **Cold starts:** with `min_machines_running = 0`, the first request after an
> idle period waits a few seconds while the machine wakes. For an always-warm
> instance, set `min_machines_running = 1` in `fly.toml` and run `fly deploy`.

---

## Accounts, Billing & Admin

CardCrop gates cropping behind a login. Free accounts get **3 crops/day** and
**1 pre-grade/month**; paid plans include unlimited crops and higher grade
allowances. Auth + data live in **Supabase**; subscriptions are billed in
**GBP** via **Stripe**.

| Plan | Price | Pre-grades | API |
|------|-------|------------|-----|
| **Free** | £0 | 1/month | — |
| **Premium** | £9.99/mo | 30/month | — |
| **Pro** | £19.99/mo | 100/month | — |
| **Enterprise** | £29.99/mo* | 100/month | REST API + keys |

\*Enterprise uses `STRIPE_PRICE_API` — update the Stripe price amount to match
your listed Enterprise price when ready.

Launch promo (Pro only): promotion code **`GEM50`** — 50% off for 3 months, new
customers only, until 1 Aug 2026. Create in Stripe with `allow_promotion_codes`
(already enabled on Checkout).

A "crop" is the first successful extraction of an uploaded image — re-cropping
and slider tweaks on the same upload are free.

### Architecture

```
Browser (React SPA + supabase-js)
   │  signup / login / reset ───────────────► Supabase Auth + Postgres (RLS)
   │  /api/* with Bearer JWT
   ▼
Node backend  ── verifies JWT (JWKS) ───────► Supabase (plan + usage, service role)
   │  meters usage_days, gates free tier
   │  Stripe Checkout / Portal ─────────────► Stripe
   ◄── /api/webhooks/stripe (subscription sync)
```

- Backend verifies the Supabase access token locally against the project JWKS
  (`backend/src/middleware/auth.ts`), with a `getUser` fallback.
- Durable state (users, usage, subscriptions, API keys) lives in Supabase, so
  metering/billing stay correct even though crop sessions are in-memory.

### Environment variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `SUPABASE_URL` | backend (secret) | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | backend (secret) | Service-role/secret key — server-only, bypasses RLS |
| `VITE_SUPABASE_URL` | frontend (build arg) | Same project URL, baked into the SPA |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | frontend (build arg) | Publishable key — safe in the browser |
| `STRIPE_SECRET_KEY` | backend (secret) | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | backend (secret) | Verifies Stripe webhook signatures |
| `STRIPE_PRICE_UNLIMITED` | backend (secret) | Premium (£9.99/mo) — `price_1TldiFIXClJKdqLnZrYEHwrv` |
| `STRIPE_PRICE_PRO` | backend (secret) | Pro (£19.99/mo) — `price_1TldjqIXClJKdqLnKCX3k5Xs` |
| `STRIPE_PRICE_API` | backend (secret) | Enterprise (Pro + API) — existing price id |

For **local dev**, `frontend/.env` holds the public `VITE_SUPABASE_*` values
(gitignored). The backend reads `SUPABASE_*` / `STRIPE_*` from its environment.

### Supabase setup

1. **Project + schema** — a dedicated Supabase project is provisioned and the
   schema (`profiles`, `subscriptions`, `usage_days`, `api_keys`) plus RLS,
   the new-user trigger, and `increment_daily_crop()` are applied as migrations.
2. **Auth redirect URLs** — in the Supabase dashboard under
   **Authentication → URL Configuration**, set the **Site URL** and add
   **Redirect URLs** for each environment:
   - `http://localhost:5173` and `http://localhost:5173/reset-password` (dev)
   - `https://gemcheck.co.uk` and `https://gemcheck.co.uk/reset-password` (prod)
3. **Email** — email confirmation is on by default. Branded GemCheck templates
   live in [`supabase/email-templates/`](supabase/email-templates/). Rebuild with
   `node supabase/email-templates/build-templates.mjs`, then apply with
   `./scripts/apply-email-templates.sh` (requires `SUPABASE_ACCESS_TOKEN` from
   [account tokens](https://supabase.com/dashboard/account/tokens)). For production
   volume, configure custom SMTP under **Authentication → Emails**.

### Stripe setup

1. Create **recurring GBP prices** in the Stripe dashboard:
   - **Premium** — £9.99/month → `STRIPE_PRICE_UNLIMITED` (`price_1TldiFIXClJKdqLnZrYEHwrv`)
   - **Pro** — £19.99/month → `STRIPE_PRICE_PRO` (`price_1TldjqIXClJKdqLnKCX3k5Xs`)
   - **Enterprise** — Pro + REST API → `STRIPE_PRICE_API` (your existing price id)
2. **Pro launch promo** — create a coupon (50% off, repeating 3 months, first-time
   customers only, expires 1 Aug 2026) and promotion code **`GEM50`** restricted
   to the Pro price. Checkout already allows promotion codes.
3. Add a **webhook endpoint** → `https://gemcheck.co.uk/api/webhooks/stripe`
   subscribed to at least:
   - `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
   - `invoice.payment_failed`
   - `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`
   - `charge.refunded`, `charge.dispute.created`
   
   Copy the signing secret to `STRIPE_WEBHOOK_SECRET`.
3. Create a **one-time GBP price** for single-grade purchases (£2.99) → `STRIPE_PRICE_GRADE_SINGLE` (include `checkout.session.completed` above).
4. Enable the **Customer Portal** (Settings → Billing → Customer portal) so the
   "Manage billing" button works.

### Fly secrets

```bash
fly secrets set \
  SUPABASE_URL=https://YOUR_REF.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx \
  STRIPE_SECRET_KEY=sk_live_xxx \
  STRIPE_WEBHOOK_SECRET=whsec_xxx \
  STRIPE_PRICE_UNLIMITED=price_1TldiFIXClJKdqLnZrYEHwrv \
  STRIPE_PRICE_PRO=price_1TldjqIXClJKdqLnKCX3k5Xs \
  STRIPE_PRICE_API=price_xxx \
  STRIPE_PRICE_GRADE_SINGLE=price_xxx

# Optional: live market pricing on grade reports (falls back to AI if unset)
# CARDMARKET_APP_TOKEN=...
# CARDMARKET_APP_SECRET=...
# CARDMARKET_ACCESS_TOKEN=...
# CARDMARKET_ACCESS_TOKEN_SECRET=...
# PRICECHARTING_API_TOKEN=...
# EUR_TO_GBP=0.85
# USD_TO_GBP=0.79
# MARKET_PRICE_CACHE_HOURS=48

# Public Supabase values are baked into the SPA at build time:
fly deploy \
  --build-arg VITE_SUPABASE_URL=https://YOUR_REF.supabase.co \
  --build-arg VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```

### Make yourself an admin

The admin console lives at `/admin` and is gated on
`auth.users.app_metadata.role = 'admin'`. After signing up, set your role once
(via the Supabase MCP `execute_sql`, the SQL editor, or the Admin API):

```sql
update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'
where email = 'you@example.com';
```

Sign out and back in so a fresh token carries the role.

### Account API endpoints

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/me` | user | Plan, crops used/remaining today, admin flag |
| `POST /api/billing/checkout` | user | Start Stripe Checkout (`{ plan }`) |
| `POST /api/billing/portal` | user | Open the Stripe Customer Portal |
| `POST /api/webhooks/stripe` | Stripe sig | Subscription sync (raw body) |
| `GET /api/admin/users` | admin | List/search users with plan + usage |
| `POST /api/admin/users/:id/role` | admin | Promote/demote admin |
| `POST /api/admin/users/:id/plan` | admin | Manual plan override |
| `POST /api/admin/users/:id/suspend` | admin | Ban/reinstate |
| `GET/POST /api/admin/users/:id/api-keys` | admin | List / issue API keys |
| `DELETE /api/admin/api-keys/:id` | admin | Revoke an API key |

> All crop endpoints (`/api/upload`, `/api/process`, `/api/export`,
> `/api/session`) now require a `Authorization: Bearer <token>` header and are
> scoped to the owning user.

---

## Manual Setup (step by step)

If `start.sh` doesn't work on your system, or you prefer to run each service separately:

### 1. Python processing service

```bash
cd python-service

# Create virtual environment
python3 -m venv .venv

# Activate it
source .venv/bin/activate        # macOS / Linux
# .venv\Scripts\activate          # Windows

# Install dependencies
pip install -r requirements.txt

# Start the service
python -m uvicorn app:app --host 127.0.0.1 --port 5001
```

Runs on **http://localhost:5001**.

### 2. Node.js backend

```bash
cd backend

npm install
npm run dev
```

Runs on **http://localhost:3001**.

### 3. React frontend

```bash
cd frontend

npm install
npm run dev
```

Runs on **http://localhost:5173**. The Vite dev server proxies `/api/*` and `/v1/*` requests to the Node backend automatically.

### All three must be running

Open three terminal windows/tabs and start each service. The frontend won't work without the backend, and the backend won't process images without the Python service.

---

## Public API

API-plan users get a versioned REST API for cropping and AI pre-grading — the
same capabilities as the web app. Interactive docs are at **`/docs`**; the raw
spec is at **`/v1/openapi.json`** (OpenAPI **1.2.0**).

### Authentication

Create keys on the **Account** page (API plan). Keys are shown once; only a
SHA-256 hash and a short prefix are stored. Send the key as a Bearer token (or
`X-API-Key`):

```
Authorization: Bearer pk_live_xxxxxxxxxxxxxxxxxxxxxxxx
```

### Endpoints

| Method | Path                   | Description                              |
|--------|------------------------|------------------------------------------|
| POST   | `/v1/crop`             | Crop a card from an image                |
| GET    | `/v1/crop/limits`      | Crop rate limit + daily usage            |
| POST   | `/v1/grade`            | AI pre-grade (multipart photos)          |
| GET    | `/v1/grade/quota`      | Grading allowance                        |
| POST   | `/v1/grade/straighten` | Straighten for centering (helper)      |
| GET    | `/v1/account`          | Plan + quota snapshot                    |
| GET    | `/v1/usage`            | Paginated API usage history              |
| GET    | `/v1/health`           | Health check (no auth)                   |
| GET    | `/v1/version`          | API version (no auth)                    |
| GET    | `/v1/openapi.json`     | OpenAPI 3.1 spec                         |

### `POST /v1/crop`

Provide the image via multipart `image`, JSON `image_url` (SSRF-guarded), or
JSON `image_base64`. Optional `params` match the web crop tool. Set
`metadata_level` to `full` (default) or `minimal`; set `include_suitability`
to `false` to skip the GPT pre-assessment. Returns JSON
`{ image_base64, metadata }` by default, or raw PNG with `Accept: image/png`.

```bash
curl -X POST https://gemcheck.co.uk/v1/crop \
  -H "Authorization: Bearer $GEMCHECK_API_KEY" \
  -H "Accept: image/png" \
  -F "image=@card.jpg" \
  -o cropped.png
```

### `POST /v1/grade`

Multipart: `front` (required), optional `back`, `angled_front`, `angled_back`,
`closeups`. Optional form field `centering` (JSON). Send `Idempotency-Key` to
safely retry without double-charging.

**JSON (default)** — returns `{ result, quota, capture_quality }`:

```bash
curl -X POST https://gemcheck.co.uk/v1/grade \
  -H "Authorization: Bearer $GEMCHECK_API_KEY" \
  -H "Idempotency-Key: grade-123" \
  -F "front=@front.jpg" -F "back=@back.jpg"
```

**PDF report** — same pre-grade PDF as the web app (`Accept: application/pdf`,
`?format=pdf`, or form field `format=pdf`). Include `front` (and `back` if you
have it) in the multipart upload:

```bash
curl -X POST "https://gemcheck.co.uk/v1/grade?format=pdf" \
  -H "Authorization: Bearer $GEMCHECK_API_KEY" \
  -H "Idempotency-Key: grade-123" \
  -F "front=@front.jpg" -F "back=@back.jpg" \
  -o pregrade-report.pdf
```

Errors use a structured envelope: `{ "error": { "code", "message" } }`.

### Rate limits

Crop requests are rate limited **per account** (not per key), in-memory on each
Fly machine. Limits apply only to **successful** crops (failed detections do not
count). Each response carries `X-RateLimit-Limit/Remaining/Reset`; a `429`
includes `Retry-After`. Defaults: `API_RATE_PER_MIN=60`, `API_DAILY_SOFT_CAP=5000`.
`crops_today` on `/v1/crop/limits` and `/v1/account` sums usage across all keys
on the account. Grading allowances are monthly (30 Premium, 100 Pro/Enterprise).
Straighten helper: `API_STRAIGHTEN_RATE_PER_MIN=30` (successful calls only).

---

## How It Works

Upload a card scan or photo. CardCrop automatically:

1. **Detects** card-like shapes using 5 parallel contour-finding passes (adaptive threshold, Canny, colour segmentation, Otsu, hierarchical)
2. **Scores** each candidate across 10 weighted criteria to identify the frontmost card (not the wrapper, not the backing card)
3. **Expands** the detected contour outward to include the full card border (not just the artwork)
4. **Refines** edges by snapping to the nearest strong gradient
5. **Cleans** the top edge to remove rear-card remnants (when a backing card is present)
6. **Masks** with curvature-based rounded corners using 8x supersampled anti-aliasing
7. **Exports** a transparent PNG with distance-transform alpha feathering

Processing typically takes 200-500ms per image.

---

## Usage

1. **Upload** — drag-and-drop or click to browse. Accepts JPG, PNG, WEBP, or PDF.
2. **Auto-process** — processing starts immediately after upload.
3. **Review** — three panels show the original, detection overlay, and extracted result on a checkerboard.
4. **Export** — "Web size" (max 1200px) or "Original size" (full resolution).

### Advanced Tools

Click **"Advanced Tools"** in the bottom bar to expand tuning controls. Most images should work well with defaults — these are for edge cases:

| Control | What it does | When to adjust |
|---------|-------------|----------------|
| Edge sensitivity | Controls Canny edge detection thresholds | Card not detected → increase to 0.7-0.9 |
| Contour threshold | Controls adaptive threshold block size | Too many false candidates → increase |
| Crop padding | Extra transparent pixels around the card (0-40px) | Tight crop cuts border → add 5-15px |
| Top-edge cleanup | Aggressiveness of rear-card removal at top edge | Rear card visible at top → increase to 0.8-1.0 |
| Corner radius | Scale the auto-detected corner radius | Corners too round/sharp → adjust (0.5 = auto) |
| Rotate correction | Straighten slightly tilted cards | Disable if rotation is unwanted |

---

## Project Structure

```
PokeCrop/
├── frontend/                  React + TypeScript + Vite + Tailwind CSS
│   ├── src/
│   │   ├── components/        UI components (UploadZone, Workspace, panels)
│   │   ├── hooks/             Zustand state store
│   │   ├── lib/               API client
│   │   ├── App.tsx            Root component
│   │   └── index.css          Theme + custom styles
│   ├── public/                Static assets (favicon, logo)
│   └── vite.config.ts         Dev server + proxy config
│
├── backend/                   Node.js + Express API gateway
│   ├── src/
│   │   ├── index.ts           Server entry
│   │   ├── routes/process.ts  Upload, process, export endpoints
│   │   └── services/          Python bridge
│   └── package.json
│
├── python-service/            FastAPI image processing microservice
│   ├── app.py                 FastAPI entry, maps /process onto the pipeline
│   ├── pipeline/              Staged crop pipeline
│   │   ├── crop.py            Orchestrator (localise→…→export)
│   │   ├── normalise.py       Input normalisation (image/PDF → BGR + full-res)
│   │   ├── localise.py        Rough ROI (GPT hint + CV evidence)
│   │   ├── boundary.py        Physical card mask (GrabCut + colour/edge)
│   │   ├── edges.py           RANSAC four-edge fit, corner intersections
│   │   ├── refine_edges.py    Full-res perpendicular-strip edge refinement
│   │   ├── validate.py        Geometry validation + confidence score
│   │   ├── warp.py            Single perspective transform to card dims
│   │   ├── orientation.py     Upright orientation (OCR + layout heuristic)
│   │   ├── corners.py         Rounded-corner radius + supersampled mask
│   │   ├── alpha.py           Regular/damaged alpha + cleanup
│   │   ├── enhance.py         White balance, lighting, sharpen, glare flag
│   │   ├── export.py          Trim/pad, PNG, grading-safe & solid-bg variants
│   │   └── manual_crop.py     Manual corner parsing
│   ├── utils/
│   │   └── geometry.py        Shape analysis helpers
│   ├── tests/                 pytest regression suite + metrics harness
│   └── requirements.txt
│
├── docker-compose.yml         Production 3-container stack
├── Dockerfile.fly             Single-container image for Fly.io
├── fly.toml                   Fly.io app config
├── deploy/fly/                nginx + supervisord config for Fly image
├── .env.example               Production config template
├── start.sh                   One-command dev launcher
├── stop.sh                    Stops dev services / frees ports
├── .gitignore
└── README.md
```

Each service also has a `Dockerfile` (and `.dockerignore`); the frontend
additionally has an `nginx.conf` used by its Compose production image.

---

## Architecture

```
Browser (React + Vite)
    │
    │  POST /api/upload    (multipart file)
    │  POST /api/process   (JSON: sessionId + params)
    │  GET  /api/export/:id?size=web|original
    ▼
Node.js backend (:3001)
    │
    │  POST /process  (multipart: image + params JSON)
    ▼
Python service (:5001)
    │
    ├─ Stage 1: Normalise (decode image / rasterise PDF at 300 DPI)
    ├─ Stage 2: Detect (5 parallel contour-finding passes)
    ├─ Stage 3: Score (10 weighted criteria, front-card discrimination)
    ├─ Stage 3b: Border expand (gradient-peak outward probing)
    ├─ Stage 4: Refine (normal-snap to nearest edge, fit minAreaRect)
    ├─ Stage 4b: Top-edge cleanup (LAB colour classification)
    ├─ Stage 5: Corners (curvature-based radius, 8x supersampled mask)
    └─ Stage 6: Mask (distance-transform feathering, pre-multiplied alpha)
```

---

## API Reference

### `POST /api/upload`

Multipart form with field `file`. Returns:

```json
{
  "sessionId": "uuid",
  "filename": "card.jpg",
  "originalBase64": "base64..."
}
```

### `POST /api/process`

```json
{
  "sessionId": "uuid",
  "params": {
    "edge_sensitivity": 0.5,
    "contour_threshold": 0.5,
    "crop_padding": 0,
    "top_edge_cleanup": 0.7,
    "corner_radius": 0.5,
    "rotate_correction": true
  }
}
```

Returns:

```json
{
  "result_web_png": "base64...",
  "edit_image_jpeg": "base64...",
  "metadata": {
    "bbox": [55, 134, 619, 856],
    "confidence": 0.897,
    "estimated_corner_radius_px": 15.5,
    "rotation_deg": 0.0,
    "candidates_found": 2,
    "selected_candidate_index": 0,
    "pipeline_time_ms": 350,
    "score_breakdown": { "aspect": 0.99, "rectangularity": 0.96, "..." : "..." }
  }
}
```

### `GET /api/export/:sessionId?size=original|web`

Downloads the extracted PNG as a file attachment.

### `DELETE /api/session/:sessionId`

Cleans up server-side resources for a session.

---

## Troubleshooting

### Python service won't start

**`ModuleNotFoundError: No module named 'cv2'`**

The virtual environment wasn't activated or dependencies weren't installed:

```bash
cd python-service
source .venv/bin/activate
pip install -r requirements.txt
```

**`error: externally-managed-environment`**

You're installing into the system Python. Always use the virtual environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### Node backend won't start

**`Cannot find module 'get-tsconfig'`**

Run a clean install:

```bash
cd backend
rm -rf node_modules package-lock.json
npm install
```

**`SyntaxError: The requested module 'express' does not provide an export named 'Router'`**

Same fix — clean install. This can happen with corrupted `node_modules`:

```bash
cd backend
rm -rf node_modules package-lock.json
npm install
```

### Frontend can't reach backend

The Vite dev server proxies `/api` to `localhost:3001`. Make sure the Node backend is running. If you're using a different port, update `frontend/vite.config.ts`:

```typescript
proxy: {
  "/api": {
    target: "http://localhost:3001",
    changeOrigin: true,
  },
},
```

### Processing returns "No card-like shapes detected"

- Increase **edge sensitivity** to 0.7-0.9
- Lower **contour threshold** to 0.2-0.3
- Ensure the card occupies at least 3% of the image area
- Very low-contrast images (card colour similar to background) are harder to detect

### PDF upload doesn't work

PyMuPDF (`fitz`) is required for PDF rasterisation. Verify it's installed:

```bash
cd python-service
source .venv/bin/activate
python3 -c "import fitz; print(fitz.version)"
```

### Port conflicts

Default ports: frontend=5173, backend=3001, python=5001. If any are in use:

- **Frontend:** edit `frontend/vite.config.ts` → `server.port`
- **Backend:** set `PORT` environment variable or edit `backend/src/index.ts`
- **Python:** set `PORT` environment variable or change the port in `start.sh`

---

## Known Limitations

1. **Single-card detection only** — selects the single best candidate. Multiple visible cards → only the highest-scoring one is extracted.
2. **Assumes roughly rectangular cards** — non-standard shapes (circular, die-cut) may not detect well.
3. **Colour-similar cards and backgrounds** — when the card border colour is very close to the background, edge detection struggles.
4. **Heavy occlusion** — if more than ~30% of the front card is covered, the contour won't score well.
5. **Extreme rotation** — handles up to ~45 degrees. Beyond that, detection may fail.
6. **In-memory sessions** — sessions expire after 30 minutes. Large images use significant memory.
7. **CPU only** — all processing is via OpenCV/NumPy. Fast enough for single images but not optimised for batch.

---

## Future Improvements

- **Multi-card detection** — return top N candidates with a card selector UI
- **Manual correction handles** — draggable corner handles on the overlay
- **Batch export** — multiple files or multi-page PDF, download all as ZIP
- **GrabCut refinement** — colour-based foreground/background segmentation
- **Perspective correction** — homography-based de-skew for angled photos
- **Template matching** — boost scoring for known card set layouts

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite 6, Tailwind CSS 4, Zustand, react-dropzone, Lucide icons |
| Backend | Node.js, Express 4, Multer, TypeScript (tsx) |
| Processing | Python 3.9+, FastAPI, OpenCV, NumPy, Pillow, PyMuPDF, scikit-image |

---

## License

MIT — see [LICENSE](LICENSE) for details.
