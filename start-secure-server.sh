#!/usr/bin/env bash
# DiagramWeaver Secure Production Server Service
# This script starts the production server with user-level permissions only

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_DIR"

# Security functions
check_file_permissions() {
    local file="$1"
    if [[ -f "$file" ]]; then
        local perms=$(stat -c %a "$file")
        if [[ "$perms" =~ [0-9]*[2367][0-9]*[2367] ]]; then
            echo "[security] WARNING: $file has group/others write permissions ($perms)"
        fi
    fi
}

# Secure port killing function (user-level only)
kill_port() {
    local port="$1"
    local pids
    
    # Only kill processes owned by current user
    if pids=$(lsof -ti tcp:"$port" -u "$(whoami)" 2>/dev/null); then
        echo "[security] Killing user processes on :$port ($pids)"
        echo "$pids" | xargs kill 2>/dev/null || true
        sleep 1
        if lsof -ti tcp:"$port" -u "$(whoami)" >/dev/null 2>&1; then
            echo "$pids" | xargs kill -9 2>/dev/null || true
        fi
    fi
}

# Security checks
echo "[security] Starting DiagramWeaver secure production server..."

# Check file permissions for security
check_file_permissions "package.json"
check_file_permissions ".env"

# Ensure we're running as non-root user
if [[ $EUID -eq 0 ]]; then
    echo "[security] ERROR: This service should not run as root"
    exit 1
fi

# Kill user processes on target port only
kill_port 3000
kill_port 3001

# Check if build exists with proper permissions
if [[ ! -d ".next" ]]; then
    echo "[security] ERROR: Build not found. Run 'npm run build' first."
    exit 1
fi

# Verify .next directory permissions
if [[ ! -r ".next" || ! -x ".next" ]]; then
    echo "[security] ERROR: Insufficient permissions on .next directory"
    exit 1
fi

# Set secure umask
umask 022

# Start the production server with security environment
echo "[security] Running npm start with user-level permissions..."
export NODE_ENV=production
export NPM_CONFIG_AUDIT=true
export NPM_CONFIG_FUND=false
export PORT=3001

exec npm run start