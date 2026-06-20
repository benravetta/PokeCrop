#!/usr/bin/env bash
# Stop anything listening on CardCrop's dev ports AND orphan dev processes
# (tsx watch often never binds a port — port-only cleanup leaves zombies).

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
PORTS=(5001 3001 5173)

echo "Stopping CardCrop services..."

# Orphan Node dev servers (tsx watch, vite, etc.) from prior ./start.sh runs.
for pattern in \
  "$ROOT/backend/node_modules/.bin/tsx" \
  "$ROOT/backend/node_modules/tsx/dist" \
  "$ROOT/frontend/node_modules/.bin/vite" \
  "$ROOT/python-service/.venv/bin/python -m uvicorn" \
  "$ROOT/python-service" \
  "PokeCrop/backend" \
  "PokeCrop/frontend" \
  "pokecrop-backend" \
  "pokecrop-frontend"
do
  pids=$(pgrep -f "$pattern" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "  Pattern ${pattern##*/} → kill $pids"
    kill -9 $pids 2>/dev/null || true
  fi
done

for port in "${PORTS[@]}"; do
  pids=$(lsof -ti :"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "  Port $port → kill $pids"
    kill -9 $pids 2>/dev/null || true
  fi
done

sleep 1

for port in "${PORTS[@]}"; do
  if lsof -ti :"$port" >/dev/null 2>&1; then
    echo "Warning: port $port still in use"
    exit 1
  fi
done

echo "All ports clear."
