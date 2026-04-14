#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Preparing SMCF VPS services..."

if [ ! -d "$ROOT_DIR/backend/node_modules" ]; then
  echo "Installing main backend dependencies..."
  (cd "$ROOT_DIR/backend" && npm install --no-audit --no-fund)
fi

if [ ! -d "$ROOT_DIR/smcf-sacco-backend/node_modules" ]; then
  echo "Installing SACCO backend dependencies..."
  (cd "$ROOT_DIR/smcf-sacco-backend" && npm install --no-audit --no-fund)
fi

echo "Building SACCO backend..."
(cd "$ROOT_DIR/smcf-sacco-backend" && npm run build)

echo "Starting or refreshing PM2 apps..."
pm2 startOrRestart "$ROOT_DIR/ecosystem.config.cjs" --update-env
pm2 save

echo "PM2 process list:"
pm2 status