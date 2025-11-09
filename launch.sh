#!/usr/bin/env bash
# Launch script for DiagramWeaver on macOS
# Usage examples:
#   ./launch.sh                 # install if needed, start Next.js dev on :9002 and open browser
#   ./launch.sh --genkit        # also start Genkit dev server
#   ./launch.sh --build         # build and run production server
#   ./launch.sh --no-open       # do not open browser automatically
#   ./launch.sh --fresh-install # force clean install (npm ci)
#   ./launch.sh --detach        # run in background and survive terminal exit

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_DIR"

PORT=9002
MODE="dev"           # dev | build
OPEN_BROWSER=1
START_GENKIT=0
FORCE_CI=0
DETACH=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --build) MODE="build" ; shift ;;
    --no-open) OPEN_BROWSER=0 ; shift ;;
    --genkit) START_GENKIT=1 ; shift ;;
    --fresh-install) FORCE_CI=1 ; shift ;;
    --detach) DETACH=1 ; shift ;;
    *) echo "Unknown option: $1" ; exit 1 ;;
  esac
done

need_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "ERROR: '$1' is required." >&2; exit 1; }; }

# Basic prerequisites
need_cmd node
need_cmd npm

# Node version check (Next.js 15 requires Node >= 18)
NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [[ "$NODE_MAJOR" -lt 18 ]]; then
  echo "ERROR: Node >= 18 required (found $(node -v))." >&2
  exit 1
fi

# Dependency install
if [[ "$FORCE_CI" -eq 1 ]]; then
  echo "[install] npm ci"
  npm ci
elif [[ ! -d node_modules ]]; then
  if [[ -f package-lock.json ]]; then
    echo "[install] npm ci (first install)"
    npm ci
  else
    echo "[install] npm install (no lockfile)"
    npm install
  fi
else
  echo "[install] dependencies present (skip). Use --fresh-install to force clean install."
fi

# Kill anything already on the dev port (9002) to avoid conflicts
kill_port() {
  local p
  if p=$(lsof -ti tcp:"$1" 2>/dev/null); then
    echo "[port] Killing processes on :$1 ($p)"
    kill $p 2>/dev/null || true
    sleep 0.5
    if lsof -ti tcp:"$1" >/dev/null; then
      kill -9 $p 2>/dev/null || true
    fi
  fi
}

# Kill processes on both ports 9002 and 3000
kill_all_ports() {
  echo "[port] Checking for processes on ports 9002 and 3000..."
  kill_port 9002
  kill_port 3000
}

# Kill existing background DiagramWeaver processes
kill_existing_background() {
  local pids
  pids=$(pgrep -f "launch.sh.*--detach" 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    echo "[cleanup] Terminating existing background DiagramWeaver processes: $pids"
    echo "$pids" | xargs kill 2>/dev/null || true
    sleep 1
    # Force kill if still running
    pids=$(pgrep -f "launch.sh.*--detach" 2>/dev/null || true)
    if [[ -n "$pids" ]]; then
      echo "$pids" | xargs kill -9 2>/dev/null || true
    fi
  fi
}

NEXT_PID=""
GENKIT_PID=""
cleanup() {
  echo "\n[cleanup] Stopping background processes..."
  [[ -n "$NEXT_PID" ]] && kill "$NEXT_PID" 2>/dev/null || true
  [[ -n "$GENKIT_PID" ]] && kill "$GENKIT_PID" 2>/dev/null || true
}

# Only set up cleanup trap if not in detach mode
if [[ "$DETACH" -eq 0 ]]; then
  trap cleanup EXIT INT TERM
fi

wait_for_http() {
  local url="$1"; local timeout="${2:-60}"; local t=0
  until curl -fsS "$url" >/dev/null 2>&1; do
    sleep 1; t=$((t+1))
    if [[ $t -ge $timeout ]]; then
      echo "[wait] Timeout waiting for $url" >&2
      return 1
    fi
  done
}

# Handle detach mode - kill existing background processes first
if [[ "$DETACH" -eq 1 ]]; then
  kill_existing_background
fi

# Kill processes on both ports before starting
kill_all_ports

if [[ "$MODE" == "build" ]]; then
  echo "[build] npm run build"
  npm run build
  echo "[start] npm run start (production)"
  # Next.js 'start' defaults to :3000; respect PORT if user exports it before running
  npm run start &
  NEXT_PID=$!
  APP_URL="http://localhost:3000"
  echo "[wait] Waiting for $APP_URL"
  wait_for_http "$APP_URL" 60 || true
else
  echo "[dev] npm run dev (port $PORT)"
  npm run dev &
  NEXT_PID=$!
  APP_URL="http://localhost:$PORT"
  echo "[wait] Waiting for $APP_URL"
  wait_for_http "$APP_URL" 60 || true
fi

echo "[ok] App running at $APP_URL"

if [[ "$START_GENKIT" -eq 1 ]]; then
  if command -v genkit >/dev/null 2>&1; then
    echo "[genkit] Starting Genkit dev server"
    npm run genkit:dev &> .genkit-dev.log &
    GENKIT_PID=$!
    echo "[genkit] Logs: .genkit-dev.log (PID $GENKIT_PID)"
  else
    echo "[genkit] 'genkit' CLI not found. Install with: npm i -g genkit-cli"
  fi
fi

if [[ "$OPEN_BROWSER" -eq 1 ]]; then
  if command -v open >/dev/null 2>&1; then
    open "$APP_URL" || true
  else
    echo "[info] Open $APP_URL in your browser."
  fi
fi

echo "[logs] Next.js PID: $NEXT_PID${GENKIT_PID:+ | Genkit PID: $GENKIT_PID}"

if [[ "$DETACH" -eq 1 ]]; then
  echo "[detach] Server started successfully. Detaching process..."
  # Disown the processes so they continue running after terminal exit
  [[ -n "$NEXT_PID" ]] && disown "$NEXT_PID" 2>/dev/null || true
  [[ -n "$GENKIT_PID" ]] && disown "$GENKIT_PID" 2>/dev/null || true
  echo "[detach] Running in background. Use 'pkill -f \"launch.sh.*--detach\"' to stop."
  exit 0
else
  echo "Press Ctrl-C to stop."
  # Keep script in foreground to keep background processes alive
  wait "$NEXT_PID" || true
fi
