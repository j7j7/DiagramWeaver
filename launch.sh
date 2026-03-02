#!/usr/bin/env bash
# DiagramWeaver - simple build and launch
# Usage: ./launch.sh [--build]

set -e

cd "$(dirname "$0")"

lsof -ti:3030 | xargs kill -9 2>/dev/null || true

BUILD_FLAG=false

for arg in "$@"; do
  case $arg in
    --build)
      BUILD_FLAG=true
      shift
      ;;
  esac
done

if [ -d "node_modules" ] && [ -f "package-lock.json" ]; then
  echo "[1/3] Dependencies already installed, skipping..."
else
  echo "[1/3] Installing dependencies..."
  npm ci 2>/dev/null || npm install
fi

if [ "$BUILD_FLAG" = true ] || [ ! -d ".next" ]; then
  echo "[2/3] Building..."
  npm run build
else
  echo "[2/3] Skipping build (use --build to force)"
fi

echo "[3/3] Starting server at http://localhost:3030"
npm run start -- -p 3030
