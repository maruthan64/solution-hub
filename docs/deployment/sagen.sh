#!/bin/bash
# CloudSolution Hub — service control for the EC2 instance. Run this from the
# instance itself (e.g. ~/sa-generator/docs/deployment/sagen.sh), not from your laptop.
#
# Usage: ./sagen.sh {start|stop|restart|status|logs|deploy|fetch-secrets}
set -e

# This file lives at <repo>/docs/deployment/sagen.sh, so the repo root is two levels up.
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SERVICES="sagen-backend sagen-frontend"
SSM_PATH="/sa-generator/prod"
AWS_REGION="ap-south-1"

fetch_secrets() {
  echo "==> Fetching secrets from SSM Parameter Store ($SSM_PATH)"
  local env_file="$APP_DIR/backend/.env"
  local tmp_file
  tmp_file="$(mktemp)"
  aws ssm get-parameters-by-path \
    --path "$SSM_PATH" \
    --with-decryption \
    --region "$AWS_REGION" \
    --query "Parameters[].[Name,Value]" \
    --output text \
  | while IFS=$'\t' read -r name value; do
      echo "${name#"$SSM_PATH"/}=$value"
    done > "$tmp_file"

  if [ ! -s "$tmp_file" ]; then
    echo "No parameters found under $SSM_PATH — leaving backend/.env untouched." >&2
    rm -f "$tmp_file"
    return 1
  fi

  mv "$tmp_file" "$env_file"
  chmod 600 "$env_file"
  echo "==> backend/.env regenerated from SSM ($(wc -l < "$env_file") values)"
}

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
  fetch-secrets)
    fetch_secrets
    echo "Run 'sagen.sh restart' to pick up the change."
    ;;
  deploy)
    echo "==> Pulling latest code"
    cd "$APP_DIR" && git pull

    fetch_secrets

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
    echo "Usage: $0 {start|stop|restart|status|logs|deploy|fetch-secrets}"
    echo
    echo "  start          - start both services"
    echo "  stop           - stop both services"
    echo "  restart        - restart both services (no code changes)"
    echo "  status         - show systemd status for both"
    echo "  logs           - tail both services' logs (Ctrl+C to stop)"
    echo "  deploy         - git pull, refresh secrets from SSM, reinstall deps, apply DB"
    echo "                   migrations, rebuild frontend, restart, health-check"
    echo "  fetch-secrets  - regenerate backend/.env from SSM Parameter Store without a full"
    echo "                   deploy (e.g. after rotating a secret) — then run 'restart'"
    exit 1
    ;;
esac
