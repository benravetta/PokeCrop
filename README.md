# PokeCrop

Local web application for extracting trading cards from scans and photos. Upload an image or PDF, and PokeCrop detects the frontmost card, preserves its exact border and rounded corners, removes the wrapper/backing card/background, and exports a transparent PNG.

---

## Prerequisites

| Tool       | Minimum version | Check                |
|------------|-----------------|----------------------|
| **Node.js**| 18+             | `node --version`     |
| **npm**    | 9+              | `npm --version`      |
| **Python** | 3.9+            | `python3 --version`  |

macOS users: if you don't have Python 3.9+, install via `brew install python@3.11`.

---

## Quick start

```bash
# Clone and enter the project
cd PokeCrop

# One-command launch (installs deps on first run)
./start.sh
```

This will:
1. Create a Python virtual environment and install pip dependencies
2. Install Node.js dependencies for the backend and frontend
3. Start all three services

Once running, open **http://localhost:5173** in your browser.

---

## Manual setup (step by step)

### 1. Python service

```bash
cd python-service

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the service
python -m uvicorn app:app --host 0.0.0.0 --port 5001 --reload
```

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

Runs on **http://localhost:5173**. The Vite dev server proxies `/api/*` requests to the Node backend automatically.

---

## Project structure

```
PokeCrop/
├── frontend/                  React + TypeScript + Vite + Tailwind CSS
│   ├── src/
│   │   ├── components/        UI components (UploadZone, Workspace, panels)
│   │   ├── hooks/             Zustand state store
│   │   ├── lib/               API client
│   │   ├── App.tsx            Root component
│   │   ├── main.tsx           Entry point
│   │   └── index.css          Tailwind config + custom styles
│   ├── public/                Static assets
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── backend/                   Node.js + Express API gateway
│   ├── src/
│   │   ├── index.ts           Server entry
│   │   ├── routes/process.ts  Upload, process, export endpoints
│   │   └── services/          Python bridge (forwards to FastAPI)
│   ├── package.json
│   └── tsconfig.json
│
├── python-service/            FastAPI image processing microservice
│   ├── app.py                 FastAPI entry, pipeline orchestrator
│   ├── pipeline/
│   │   ├── normalise.py       Stage 1: input normalisation (image/PDF)
│   │   ├── detect.py          Stage 2: multi-pass candidate detection
│   │   ├── score.py           Stage 3: candidate scoring & discrimination
│   │   ├── refine.py          Stage 4: edge refinement & rotation
│   │   ├── top_edge.py        Stage 4b: top-edge rear-card cleanup
│   │   ├── corners.py         Stage 5: rounded-corner detection & mask
│   │   └── mask.py            Stage 6: alpha compositing & PNG export
│   ├── utils/
│   │   ├── geometry.py        Shape analysis helpers
│   │   └── colour.py          Colour analysis helpers (LAB, k-means)
│   └── requirements.txt
│
├── start.sh                   One-command launcher
└── README.md
```

---

## Architecture

```
Browser (React)
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
    ├─ Stage 1: Normalise (decode image / rasterise PDF)
    ├─ Stage 2: Detect (5 parallel contour-finding passes)
    ├─ Stage 3: Score (10 weighted criteria, front-card discrimination)
    ├─ Stage 4: Refine (normal-snap edges, fit minAreaRect, rotate)
    ├─ Stage 4b: Top-edge cleanup (LAB colour classification)
    ├─ Stage 5: Corners (curvature-based radius, 8x supersampled mask)
    └─ Stage 6: Mask (distance-transform feathering, pre-multiplied alpha)
```

---

## Usage workflow

1. **Upload** — drag-and-drop or click to browse. Accepts JPG, PNG, WEBP, or PDF.
2. **Auto-process** — processing starts immediately after upload.
3. **Review** — three panels show the original, detection overlay (green = selected card, orange = fitted rectangle), and the extracted result on a checkerboard.
4. **Adjust** — use the bottom panel sliders to tune:
   - **Edge sensitivity** — lower = more permissive edge detection
   - **Contour threshold** — controls adaptive threshold block size
   - **Crop padding** — extra pixels around the card (0-40)
   - **Top-edge cleanup** — aggressiveness of rear-card removal (0 = off)
   - **Corner radius** — scale the auto-detected radius (0.5 = auto)
   - **Rotate correction** — straighten slightly tilted cards
5. **Reprocess** — click "Reprocess" after changing sliders.
6. **Export** — "Web size" (max 1200px) or "Original size" (full resolution).

---

## Adjustment guide

| Scenario | Recommended adjustments |
|----------|------------------------|
| Card not detected | Increase edge sensitivity (0.7-0.9), lower contour threshold |
| Wrong card selected (wrapper chosen) | Decrease edge sensitivity, the scoring should prefer the inner card |
| Rear card visible at top | Increase top-edge cleanup (0.8-1.0) |
| Corners too rounded / not rounded enough | Adjust corner radius (< 0.5 = sharper, > 0.5 = rounder) |
| Card slightly tilted | Enable rotate correction (on by default) |
| Tight crop cuts border | Increase crop padding (5-15px) |

---

## API reference

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

JSON body:

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
  "overlay_png": "base64...",
  "metadata": {
    "bbox": [x, y, w, h],
    "confidence": 0.85,
    "estimated_corner_radius_px": 12.5,
    "rotation_deg": 1.2,
    "candidates_found": 5,
    "selected_candidate_index": 2,
    "pipeline_time_ms": 340,
    "score_breakdown": { "aspect": 0.95, "rectangularity": 0.92, ... }
  }
}
```

### `GET /api/export/:sessionId?size=original|web`

Downloads the extracted PNG as a file attachment.

---

## Troubleshooting

### Python service won't start

**`ModuleNotFoundError: No module named 'cv2'`**

The virtual environment wasn't activated or dependencies weren't installed. Run:

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

### Frontend can't reach backend

The Vite dev server proxies `/api` to `localhost:3001`. Make sure the Node backend is running. Check the terminal for errors.

If you're running the frontend on a different port or host, update `vite.config.ts`:

```typescript
proxy: {
  "/api": {
    target: "http://localhost:3001",
    changeOrigin: true,
  },
},
```

### Processing returns "No card-like shapes detected"

- Try increasing **edge sensitivity** to 0.7-0.9
- Try lowering **contour threshold** to 0.2-0.3
- Make sure the card occupies at least 3% of the image area
- Very low-contrast images (card colour similar to background) are harder to detect

### Slow processing

Large images (4000px+) are automatically downscaled to 2000px for detection. Processing typically takes 200-800ms. If it's consistently slow:

- Check that `opencv-python-headless` is installed (not the full `opencv-python` which pulls in GUI deps)
- Ensure you're using Python 3.9+ (older versions have slower NumPy)

### PDF upload doesn't work

PyMuPDF (`fitz`) is required for PDF rasterisation. Verify it's installed:

```bash
python3 -c "import fitz; print(fitz.version)"
```

### Port conflicts

Default ports: frontend=5173, backend=3001, python=5001. If any are in use:

- Frontend: edit `vite.config.ts` → `server.port`
- Backend: edit `backend/src/index.ts` → `PORT`
- Python: change the port in `start.sh` and set `PYTHON_URL` env var for the backend

---

## Known limitations

1. **Single-card detection only** — the pipeline selects the single best candidate. If multiple cards are visible, only the highest-scoring one is extracted.

2. **Assumes roughly rectangular cards** — non-standard card shapes (circular, die-cut, irregularly shaped promos) may not be detected or may produce poor masks.

3. **Colour-similar cards and backgrounds** — when the card border colour is very close to the background colour, edge detection struggles. The colour segmentation pass helps but isn't perfect.

4. **Heavy occlusion** — if more than ~30% of the front card is covered by another object, the contour won't be complete enough to score well.

5. **Extreme rotation** — rotation correction handles angles up to ~45 degrees. Beyond that, the card may not be detected at all.

6. **Session storage is in-memory** — sessions (including full-resolution base64 results) are stored in the Node process memory. Sessions expire after 30 minutes. For very large images, memory usage can be significant.

7. **No GPU acceleration** — all processing is CPU-based via OpenCV/NumPy. This is fast enough for single images but would need optimization for batch workloads.

---

## Future improvements

### Multi-card detection
Extend the pipeline to return the top N candidates instead of just the best one. The scoring infrastructure already ranks all candidates — the UI would need a card selector to let the user pick which card to extract, or extract all at once.

### Manual correction handles
Add draggable corner handles on the detection overlay so the user can manually adjust the card boundary after auto-detection. The backend would accept a user-provided 4-point polygon and skip stages 2-4, going straight to corner masking and alpha output.

### Batch export
Accept multiple files at once (or a multi-page PDF) and process them in sequence. Add a queue UI with progress indicators and a "download all as ZIP" button. The Python service already handles one image at a time, so this is primarily a frontend/backend orchestration change.

### GrabCut refinement
Add an optional GrabCut pass after initial detection to refine the mask using colour-based foreground/background segmentation. This would help with cases where the contour-based approach misses subtle edges.

### Perspective correction
For photos taken at an angle, add a homography-based perspective correction step that transforms the card to a perfect rectangle before masking. The 4 detected corners provide the source points; the target points would be a standard card aspect ratio rectangle.

### Template matching
For known card sets (e.g., standard Pokemon card layouts), use template matching to improve detection confidence. A small library of card border templates could be matched against candidates to boost scoring.

### Drag-and-drop reordering for batch
When processing multiple cards, allow drag-and-drop reordering of results before export.

### Dark/light card border detection
Improve the top-edge cleanup by detecting whether the card has a light or dark border, and adjusting the LAB distance thresholds accordingly. Currently the thresholds are tuned for typical card borders.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite 6, Tailwind CSS 4, Zustand, react-dropzone, Lucide icons |
| Backend | Node.js, Express 4, Multer, TypeScript (tsx) |
| Processing | Python 3.9+, FastAPI, OpenCV, NumPy, Pillow, PyMuPDF, scikit-image |

---

## License

Private project. Not licensed for redistribution.
