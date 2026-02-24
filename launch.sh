#!/usr/bin/env bash
# DiagramWeaver - simple build and launch
# Usage: ./launch.sh

set -e

cd "$(dirname "$0")"

if [ -d "node_modules" ] && [ -f "package-lock.json" ]; then
  echo "[1/3] Dependencies already installed, skipping..."
else
  echo "[1/3] Installing dependencies..."
  npm ci 2>/dev/null || npm install
fi

echo "[2/3] Building..."
npm run build

echo "[3/3] Starting server at http://localhost:3030"
npm run start -- -p 3030
