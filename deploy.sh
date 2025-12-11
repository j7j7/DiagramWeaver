#!/bin/bash

# DiagramWeaver Deployment Script
# Deploys the application from /opt/DiagramWeaver to /var/www/html

set -e  # Exit on any error

echo "🚀 Starting DiagramWeaver deployment..."

# Variables
SOURCE_DIR="/opt/DiagramWeaver"
WEB_ROOT="/var/www/html"
BACKUP_DIR="/var/www/html_backup_$(date +%Y%m%d_%H%M%S)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

# Check if running from correct directory
if [ ! -f "$SOURCE_DIR/package.json" ]; then
    error "package.json not found in $SOURCE_DIR. Are you in the right directory?"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    error "Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Create backup of current production files
if [ -d "$WEB_ROOT/.next" ]; then
    log "📦 Creating backup of current production files..."
    mkdir -p "$BACKUP_DIR"
    cp -r "$WEB_ROOT/.next" "$BACKUP_DIR/"
    cp -r "$WEB_ROOT/resources" "$BACKUP_DIR/" 2>/dev/null || true
    cp "$WEB_ROOT"/*.png "$BACKUP_DIR/" 2>/dev/null || true
    cp "$WEB_ROOT"/*.webp "$BACKUP_DIR/" 2>/dev/null || true
    cp "$WEB_ROOT"/*.md "$BACKUP_DIR/" 2>/dev/null || true
    log "✅ Backup created at $BACKUP_DIR"
fi

# Pull latest changes from git
log "📥 Pulling latest changes from git..."
cd "$SOURCE_DIR"
git pull origin main

# Install dependencies
log "📦 Installing dependencies..."
npm install --legacy-peer-deps

# Build the application
log "🔨 Building the application..."
npm run build

# Stop current Next.js server
log "🛑 Stopping current Next.js server..."
pkill -f "next start" || true
sleep 2

# Copy production files to web root
log "📋 Copying production files to web root..."

# Remove old production files (keep .next for atomic replacement)
rm -rf "$WEB_ROOT/.next" "$WEB_ROOT/resources" "$WEB_ROOT"/*.png "$WEB_ROOT"/*.webp "$WEB_ROOT"/*.md 2>/dev/null || true

# Copy new production files
cp -r "$SOURCE_DIR/.next" "$WEB_ROOT/"
cp -r "$SOURCE_DIR/resources" "$WEB_ROOT/" 2>/dev/null || true
cp "$SOURCE_DIR"/*.png "$WEB_ROOT/" 2>/dev/null || true
cp "$SOURCE_DIR"/*.webp "$WEB_ROOT/" 2>/dev/null || true
cp "$SOURCE_DIR"/*.md "$WEB_ROOT/" 2>/dev/null || true

# Set proper permissions
log "🔒 Setting proper permissions..."
chown -R www-data:www-data "$WEB_ROOT/.next" "$WEB_ROOT/resources" 2>/dev/null || true
chmod -R 755 "$WEB_ROOT/.next" "$WEB_ROOT/resources" 2>/dev/null || true

# Start Next.js server
log "🚀 Starting Next.js server..."
cd "$SOURCE_DIR"
nohup npm start > /var/log/diagramweaver.log 2>&1 &
NEXTJS_PID=$!

# Wait for server to start
log "⏳ Waiting for server to start..."
sleep 5

# Check if server is running
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    log "✅ Next.js server started successfully (PID: $NEXTJS_PID)"
else
    error "❌ Next.js server failed to start"
    # Restore backup if deployment failed
    if [ -d "$BACKUP_DIR" ]; then
        warn "🔄 Restoring backup due to deployment failure..."
        rm -rf "$WEB_ROOT/.next" "$WEB_ROOT/resources" "$WEB_ROOT"/*.png "$WEB_ROOT"/*.webp "$WEB_ROOT"/*.md 2>/dev/null || true
        cp -r "$BACKUP_DIR"/* "$WEB_ROOT/"
        cd "$SOURCE_DIR"
        nohup npm start > /var/log/diagramweaver.log 2>&1 &
    fi
    exit 1
fi

# Test Apache proxy
log "🌐 Testing Apache proxy..."
if curl -f http://localhost > /dev/null 2>&1; then
    log "✅ Apache proxy is working correctly"
else
    warn "⚠️  Apache proxy test failed, but Next.js server is running"
fi

# Cleanup old backups (keep last 5)
log "🧹 Cleaning up old backups..."
ls -1t /var/www/html_backup_* | tail -n +6 | xargs rm -rf 2>/dev/null || true

log "🎉 Deployment completed successfully!"
log "📊 Deployment summary:"
log "   - Source: $SOURCE_DIR"
log "   - Web root: $WEB_ROOT"
log "   - Next.js PID: $NEXTJS_PID"
log "   - Backup: $BACKUP_DIR"
log "   - Logs: /var/log/diagramweaver.log"

echo ""
echo "🔍 Useful commands:"
echo "   View logs: tail -f /var/log/diagramweaver.log"
echo "   Stop server: pkill -f 'next start'"
echo "   Restart server: cd $SOURCE_DIR && npm start"
echo "   Restore backup: cp -r $BACKUP_DIR/* $WEB_ROOT/"