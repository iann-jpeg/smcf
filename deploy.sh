#!/bin/bash

cd /var/www/smcf

echo "📥 Pulling latest code..."
git pull origin main

echo "📦 Installing dependencies..."
npm install

echo "🏗️ Building app..."
npm run build

echo "🔁 Restarting services..."
pm2 restart all

echo "✅ Deploy complete!"
