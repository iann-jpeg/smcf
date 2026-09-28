#!/bin/bash

cd /var/www/smcf

echo "📥 Pulling latest code..."
git pull origin main

echo "📦 Installing dependencies..."
npm install
cd smcf-sacco-backend
npm install
cd ..

echo "🏗️ Building app..."
npm run build
cd smcf-sacco-backend
npm run build
cd ..

echo "🔁 Restarting services..."
pm2 restart all

echo "✅ Deploy complete!"
