#!/bin/bash

echo "🔍 SMCF Render Deployment Verification"
echo "========================================"
echo ""

# Check if render.yaml exists
if [ -f "render.yaml" ]; then
    echo "✅ render.yaml found"
else
    echo "❌ render.yaml NOT found"
    exit 1
fi

# Check if backend directory exists
if [ -d "backend" ]; then
    echo "✅ backend directory found"
else
    echo "❌ backend directory NOT found"
    exit 1
fi

# Check if package.json exists in backend
if [ -f "backend/package.json" ]; then
    echo "✅ backend/package.json found"
else
    echo "❌ backend/package.json NOT found"
    exit 1
fi

# Check if server.js exists
if [ -f "backend/server.js" ]; then
    echo "✅ backend/server.js found"
else
    echo "❌ backend/server.js NOT found"
    exit 1
fi

# Check for Node version files
if [ -f ".node-version" ] || [ -f ".nvmrc" ]; then
    echo "✅ Node version file found"
else
    echo "⚠️  No .node-version or .nvmrc file (optional but recommended)"
fi

# Check if .env is NOT committed
if [ -f "backend/.env" ]; then
    if git ls-files --error-unmatch backend/.env 2>/dev/null; then
        echo "❌ WARNING: backend/.env is tracked by Git! This is a security risk!"
    else
        echo "✅ backend/.env exists but not tracked by Git"
    fi
else
    echo "ℹ️  No backend/.env file (fine for production deployment)"
fi

echo ""
echo "📋 Pre-Deployment Checklist:"
echo "----------------------------"
echo "1. [ ] MongoDB Atlas network access allows 0.0.0.0/0"
echo "2. [ ] All environment variables set in Render dashboard"
echo "3. [ ] Latest code pushed to GitHub main branch"
echo "4. [ ] MONGODB_URI is correct and tested"
echo "5. [ ] JWT_SECRET is set to a secure value"
echo "6. [ ] CLIENT_URL points to your frontend domain"
echo ""
echo "🚀 Ready to deploy! Push to GitHub and let Render do its magic."
