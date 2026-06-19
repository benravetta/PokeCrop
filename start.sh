#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

node_is_supported() {
  command -v node >/dev/null 2>&1 || return 1
  local major
  major="$(node -p 'process.versions.node.split(".")[0]')" || return 1
  [ "$major" -ge 20 ] && [ "$major" -lt 25 ]
}

ensure_node() {
  if node_is_supported; then
    return 0
  fi

  echo "Node $(node -v 2>/dev/null || echo 'not found') is not supported (need 20-24). Looking for a compatible runtime..."

  if [ -s "$ROOT/.nvmrc" ] && [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then
    # shellcheck source=/dev/null
    . "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
    if nvm use --silent >/dev/null 2>&1 && node_is_supported; then
      echo "Using Node $(node -v) via nvm (.nvmrc)"
      return 0
    fi
  fi

  for prefix in /opt/homebrew/opt/node@22 /usr/local/opt/node@22 /opt/homebrew/opt/node@24 /usr/local/opt/node@24; do
    if [ -x "$prefix/bin/node" ]; then
      export PATH="$prefix/bin:$PATH"
      if node_is_supported; then
        echo "Using Node $(node -v) from $prefix"
        return 0
      fi
    fi
  done

  echo "Error: PokeCrop requires Node.js 20-24."
  echo "Install one with: brew install node@22"
  echo "Or, if you use nvm: nvm install 22 && nvm use"
  exit 1
}

wait_for_url() {
  local url="$1"
  local label="$2"
  local tries="${3:-60}"

  for ((i = 1; i <= tries; i++)); do
    if curl -sf "$url" >/dev/null 2>&1; then
      echo "  ✓ $label"
      return 0
    fi
    sleep 0.5
  done

  echo "  ✗ $label failed to start (timeout after $((tries / 2))s)"
  return 1
}

echo "=== PokeCrop — Starting all services ==="
echo ""

# Always stop stale processes from previous runs (main cause of "Address already in use"
# and hung tsx watch orphans that never bind port 3001).
bash "$ROOT/stop.sh"

ensure_node
command -v python3 >/dev/null 2>&1 || { echo "Error: Python 3 is required."; exit 1; }

VENV="$ROOT/python-service/.venv"
if [ ! -x "$VENV/bin/python" ]; then
  if [ -d "$VENV" ]; then
    echo "Python virtual environment is broken — recreating..."
    rm -rf "$VENV"
  else
    echo "[1/3] Creating Python virtual environment..."
  fi
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install -q -r "$ROOT/python-service/requirements.txt"
fi

PYTHON_BIN="$VENV/bin/python"

if [ ! -d "$ROOT/backend/node_modules" ]; then
  echo "[2/3] Installing backend dependencies..."
  (cd "$ROOT/backend" && npm install --silent)
fi

if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo "[3/3] Installing frontend dependencies..."
  (cd "$ROOT/frontend" && npm install --silent)
fi

echo ""
echo "Starting services (one at a time)..."
echo ""

# Python first — OpenCV import is heavy; starting Node in parallel used to starve it.
echo "[1/3] Python (card processing)..."
(cd "$ROOT/python-service" && "$PYTHON_BIN" -m uvicorn app:app --host 127.0.0.1 --port 5001) &
PYTHON_PID=$!
wait_for_url "http://127.0.0.1:5001/health" "Python  :5001" 120 || {
  echo "Python failed. Check python-service logs above."
  kill $PYTHON_PID 2>/dev/null || true
  exit 1
}

# Build the backend into a single self-contained bundle if the sources changed.
# This avoids cold-loading thousands of node_modules files at startup, which
# stalls badly on slow/near-full disks (the recurring "backend never starts" bug).
BUNDLE="$ROOT/backend/dist/server.cjs"
needs_build=0
if [ ! -f "$BUNDLE" ]; then
  needs_build=1
else
  while IFS= read -r src; do
    if [ "$src" -nt "$BUNDLE" ]; then needs_build=1; break; fi
  done < <(find "$ROOT/backend/src" -type f -name '*.ts')
fi
if [ "$needs_build" -eq 1 ]; then
  echo "Building backend bundle..."
  (cd "$ROOT/backend" && npm run build) || { echo "Backend build failed."; exit 1; }
fi

echo "[2/3] Backend..."
(cd "$ROOT/backend" && npm run start) &
BACKEND_PID=$!
wait_for_url "http://127.0.0.1:3001/api/health" "Backend :3001" 60 || {
  echo "Backend failed. Run ./stop.sh and try again."
  kill $PYTHON_PID $BACKEND_PID 2>/dev/null || true
  exit 1
}

echo "[3/3] Frontend..."
(cd "$ROOT/frontend" && npm run dev) &
FRONTEND_PID=$!
# First-ever start can take ~30s while Vite optimizes deps off a slow disk.
wait_for_url "http://127.0.0.1:5173/" "Frontend:5173" 120 || {
  echo "Frontend failed. Run ./stop.sh and try again."
  kill $PYTHON_PID $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
  exit 1
}

echo ""
echo "  App:             http://localhost:5173"
echo "  Node backend:    http://localhost:3001"
echo "  Python service:  http://localhost:5001"
echo ""
echo "Press Ctrl+C to stop all services."
echo ""

cleanup() {
  echo ""
  echo "Shutting down..."
  kill $PYTHON_PID $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
  wait 2>/dev/null || true
  echo "Done."
}

trap cleanup EXIT INT TERM

wait
