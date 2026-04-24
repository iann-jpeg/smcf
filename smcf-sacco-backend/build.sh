#!/usr/bin/env bash
# exit on error
set -o errexit

echo "Installing dependencies..."
npm install

echo "Building TypeScript..."
npm run build

echo "Build complete!"
