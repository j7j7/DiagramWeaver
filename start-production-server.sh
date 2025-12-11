#!/usr/bin/env bash
# DiagramWeaver Production Server Service
# This script starts the production server only (assumes build is already done)

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_DIR"

# Kill any existing processes on port 3000
kill_port() {
    local p
    if p=$(lsof -ti tcp:"$1" 2>/dev/null); then
        echo "[service] Killing processes on :$1 ($p)"
        echo "$p" | xargs kill 2>/dev/null || true
        sleep 1
        if lsof -ti tcp:"$1" >/dev/null 2>&1; then
            echo "$p" | xargs kill -9 2>/dev/null || true
        fi
    fi
}

echo "[service] Starting DiagramWeaver production server..."
kill_port 3000

# Check if build exists
if [[ ! -d ".next" ]]; then
    echo "[service] ERROR: Build not found. Run 'npm run build' first."
    exit 1
fi

# Start the production server
echo "[service] Running npm start on port 3000..."
exec npm run start