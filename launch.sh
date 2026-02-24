#!/usr/bin/env bash
# DiagramWeaver - simple build and launch
# Usage: ./launch.sh

set -e

cd "$(dirname "$0")"

echo "[1/3] Installing dependencies..."
npm ci 2>/dev/null || npm install

echo "[2/3] Building..."
npm run build

echo "[3/3] Starting server at http://localhost:3030"
npm run start -- -p 3030
