#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "=== PokeCrop — Starting all services ==="
echo ""

# ── Dependency checks ──
command -v node >/dev/null 2>&1 || { echo "Error: Node.js is required. Install from https://nodejs.org"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "Error: Python 3 is required."; exit 1; }

# ── Python virtual environment ──
VENV="$ROOT/python-service/.venv"
if [ ! -d "$VENV" ]; then
  echo "[1/3] Creating Python virtual environment..."
  python3 -m venv "$VENV"
  source "$VENV/bin/activate"
  pip install -q -r "$ROOT/python-service/requirements.txt"
else
  source "$VENV/bin/activate"
fi

PYTHON_BIN="$VENV/bin/python"

# ── Node dependencies ──
if [ ! -d "$ROOT/backend/node_modules" ]; then
  echo "[2/3] Installing backend dependencies..."
  (cd "$ROOT/backend" && npm install --silent)
fi

if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo "[3/3] Installing frontend dependencies..."
  (cd "$ROOT/frontend" && npm install --silent)
fi

echo ""
echo "Starting services..."
echo ""

# Start Python service (use the venv python directly so it works in the subshell)
(cd "$ROOT/python-service" && "$PYTHON_BIN" -m uvicorn app:app --host 127.0.0.1 --port 5001 --reload) &
PYTHON_PID=$!

# Start Node backend
(cd "$ROOT/backend" && npm run dev) &
BACKEND_PID=$!

# Start frontend dev server
(cd "$ROOT/frontend" && npm run dev) &
FRONTEND_PID=$!

echo ""
echo "  Python service:  http://localhost:5001"
echo "  Node backend:    http://localhost:3001"
echo "  Frontend:        http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop all services."
echo ""

cleanup() {
  echo ""
  echo "Shutting down..."
  kill $PYTHON_PID $BACKEND_PID $FRONTEND_PID 2>/dev/null
  wait 2>/dev/null
  echo "Done."
}

trap cleanup EXIT INT TERM

wait
