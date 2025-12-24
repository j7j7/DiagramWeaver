#!/usr/bin/env bash
# DiagramWeaver Secure Service Manager
# Usage: ./dw-secure-service.sh [start|stop|restart|status|logs|enable|disable]

set -euo pipefail

SERVICE_NAME="diagramweaver-secure"
SERVICE_FILE="/home/j7/code/github/DiagramWeaver/diagramweaver-secure.service"
SYSTEMD_DIR="$HOME/.config/systemd/user"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[DW-SECURE]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[DW-SECURE]${NC} $1"
}

error() {
    echo -e "${RED}[DW-SECURE]${NC} $1"
}

info() {
    echo -e "${BLUE}[DW-SECURE]${NC} $1"
}

# Ensure systemd user directory exists
setup_systemd() {
    if [[ ! -d "$SYSTEMD_DIR" ]]; then
        mkdir -p "$SYSTEMD_DIR"
        log "Created systemd user directory: $SYSTEMD_DIR"
    fi
}

# Install the secure service file
install_service() {
    setup_systemd
    if [[ ! -L "$SYSTEMD_DIR/$SERVICE_NAME.service" ]]; then
        ln -sf "$SERVICE_FILE" "$SYSTEMD_DIR/$SERVICE_NAME.service"
        log "Linked secure service file to systemd user directory"
        systemctl --user daemon-reload
        log "Reloaded systemd daemon"
    fi
}

# Build the application before starting service
build_app() {
    log "Building DiagramWeaver application..."
    cd /home/j7/code/github/DiagramWeaver
    npm run build
    if [[ $? -eq 0 ]]; then
        log "✅ Build completed successfully"
    else
        error "❌ Build failed"
        exit 1
    fi
}

# Command handlers
start_service() {
    install_service
    log "Building and starting DiagramWeaver secure service..."
    build_app
    systemctl --user start "$SERVICE_NAME.service"
    if systemctl --user is-active --quiet "$SERVICE_NAME.service"; then
        log "✅ Secure service started successfully"
        show_status
    else
        error "❌ Failed to start secure service"
        exit 1
    fi
}

stop_service() {
    log "Stopping DiagramWeaver secure service..."
    systemctl --user stop "$SERVICE_NAME.service"
    if systemctl --user is-active --quiet "$SERVICE_NAME.service"; then
        error "❌ Failed to stop secure service"
        exit 1
    else
        log "✅ Secure service stopped successfully"
    fi
}

restart_service() {
    log "Rebuilding and restarting DiagramWeaver secure service..."
    build_app
    systemctl --user restart "$SERVICE_NAME.service"
    sleep 2
    if systemctl --user is-active --quiet "$SERVICE_NAME.service"; then
        log "✅ Secure service restarted successfully"
        show_status
    else
        error "❌ Failed to restart secure service"
        exit 1
    fi
}

show_status() {
    info "Secure service status:"
    systemctl --user status "$SERVICE_NAME.service" --no-pager -l
}

show_logs() {
    info "Secure service logs (use -f for follow):"
    if [[ "${1:-}" == "-f" ]]; then
        journalctl --user -u "$SERVICE_NAME.service" -f
    else
        journalctl --user -u "$SERVICE_NAME.service" -n 50 --no-pager
    fi
}

enable_service() {
    install_service
    log "Enabling DiagramWeaver secure service to start on login..."
    systemctl --user enable "$SERVICE_NAME.service"
    log "✅ Secure service enabled - will start automatically on login"
}

disable_service() {
    log "Disabling DiagramWeaver secure service..."
    systemctl --user disable "$SERVICE_NAME.service"
    log "✅ Secure service disabled - will not start automatically on login"
}

# Show help
show_help() {
    echo "DiagramWeaver Secure Service Manager"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  start    - Build and start the secure production service"
    echo "  stop     - Stop the secure production service"
    echo "  restart  - Rebuild and restart secure service (use after code changes)"
    echo "  status   - Show secure service status"
    echo "  logs     - Show secure service logs (add -f to follow)"
    echo "  enable   - Enable secure service to start on login"
    echo "  disable  - Disable secure service from starting on login"
    echo "  help     - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 start          # Build and start the secure service"
    echo "  $0 restart        # Rebuild and restart after making changes"
    echo "  $0 logs -f        # Follow logs in real-time"
    echo "  $0 status         # Check if running"
    echo "  $0 help           # Show this help"
}

# Main command dispatcher
case "${1:-}" in
    start)
        start_service
        ;;
    stop)
        stop_service
        ;;
    restart)
        restart_service
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs "${2:-}"
        ;;
    enable)
        enable_service
        ;;
    disable)
        disable_service
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        error "Unknown command: ${1:-}"
        echo ""
        show_help
        exit 1
        ;;
esac