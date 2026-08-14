#!/bin/bash
# CloudSolution Hub — service control for the EC2 instance. Run this from the
# instance itself (e.g. ~/sa-generator/docs/deployment/sagen.sh), not from your laptop.
#
# Usage: ./sagen.sh {start|stop|restart|status|logs|deploy}
set -e

# This file lives at <repo>/docs/deployment/sagen.sh, so the repo root is two levels up.
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SERVICES="sagen-backend sagen-frontend"

case "$1" in
  start)
    sudo systemctl start $SERVICES
    ;;
  stop)
    sudo systemctl stop $SERVICES
    ;;
  restart)
    sudo systemctl restart $SERVICES
    ;;
  status)
    systemctl status $SERVICES --no-pager -l
    ;;
  logs)
    sudo journalctl -u sagen-backend -u sagen-frontend -f --no-pager
    ;;
  deploy)
    echo "==> Pulling latest code"
    cd "$APP_DIR" && git pull

    echo "==> Installing backend dependencies"
    cd "$APP_DIR/backend" && source venv/bin/activate && pip install -r requirements.txt

    echo "==> Applying database migrations"
    alembic upgrade head

    echo "==> Building frontend"
    cd "$APP_DIR/frontend" && npm install && npm run build

    echo "==> Restarting services"
    sudo systemctl restart $SERVICES

    sleep 2
    echo "==> Health check"
    curl -sf http://127.0.0.1:8000/api/health && echo
    curl -s -o /dev/null -w "frontend: %{http_code}\n" http://127.0.0.1:3000
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status|logs|deploy}"
    echo
    echo "  start    - start both services"
    echo "  stop     - stop both services"
    echo "  restart  - restart both services (no code changes)"
    echo "  status   - show systemd status for both"
    echo "  logs     - tail both services' logs (Ctrl+C to stop)"
    echo "  deploy   - git pull, reinstall deps, apply DB migrations, rebuild frontend, restart, health-check"
    exit 1
    ;;
esac
