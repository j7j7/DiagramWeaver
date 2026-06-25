#!/usr/bin/env bash
# DiagramWeaver - simple build and launch
# Usage: ./launch.sh [--build]
# Port: PORT env (default 9003, matches package.json dev/serve)

set -e

cd "$(dirname "$0")"

PORT="${PORT:-9003}"

lsof -ti:"$PORT" | xargs kill -9 2>/dev/null || true

BUILD_FLAG=false

for arg in "$@"; do
  case $arg in
    --build)
      BUILD_FLAG=true
      ;;
  esac
done

if [ -d "node_modules" ] && [ -f "package-lock.json" ]; then
  echo "[1/3] Dependencies already installed, skipping..."
else
  echo "[1/3] Installing dependencies..."
  npm ci 2>/dev/null || npm install
fi

if [ "$BUILD_FLAG" = true ]; then
  echo "[2/3] Building..."
  npm run build
  echo "[3/3] Starting static server at http://localhost:${PORT}"
  npx --yes serve@14 out -l "$PORT"
else
  echo "[2/3] Starting dev server at http://localhost:${PORT} (use --build for production)"
  # package.json dev script already binds -p 9003; honor PORT when overridden
  if [ "$PORT" = "9003" ]; then
    npm run dev
  else
    npx next dev --turbopack -H 0.0.0.0 -p "$PORT"
  fi
fi
