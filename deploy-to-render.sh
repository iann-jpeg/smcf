#!/bin/bash

echo "🚀 Deploying SMCF Backend to Render"
echo "===================================="
echo ""

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Not a git repository. Please run 'git init' first."
    exit 1
fi

echo "📋 Files changed for Render deployment:"
echo "  - render.yaml (new)"
echo "  - .node-version (new)"
echo "  - .nvmrc (new)"
echo "  - Procfile (new)"
echo "  - backend/server.js (updated)"
echo "  - backend/package.json (updated)"
echo "  - backend/routes/auth.js (updated)"
echo "  - RENDER_DEPLOYMENT.md (new)"
echo "  - RENDER_FIX_SUMMARY.md (new)"
echo ""

# Check git status
echo "📊 Git Status:"
git status --short

echo ""
read -p "Do you want to commit and push these changes? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "✅ Adding files to git..."
    git add render.yaml .node-version .nvmrc Procfile backend/server.js backend/package.json backend/routes/auth.js RENDER_DEPLOYMENT.md RENDER_FIX_SUMMARY.md verify-deployment.sh deploy-to-render.sh
    
    echo "✅ Committing changes..."
    git commit -m "Fix Render deployment: Add proper configuration and error handling

- Add render.yaml for automatic Render deployment
- Specify Node.js version with .node-version and .nvmrc
- Add health check endpoints
- Improve MongoDB connection error handling
- Add graceful shutdown for production
- Enhanced startup logging for debugging
- Add comprehensive deployment documentation"
    
    echo "✅ Pushing to GitHub..."
    git push origin main
    
    echo ""
    echo "✅ Changes pushed successfully!"
    echo ""
    echo "📝 Next Steps:"
    echo "1. Go to Render Dashboard: https://dashboard.render.com/"
    echo "2. Create new Web Service from your GitHub repo (or it will auto-deploy)"
    echo "3. Set environment variables:"
    echo "   - MONGODB_URI"
    echo "   - JWT_SECRET"
    echo "   - CLIENT_URL"
    echo "   - ADMIN_PHONE"
    echo "   - LIPIA_API_KEY"
    echo "   - LIPIA_APP_ID"
    echo "4. Wait for deployment to complete (~2-3 minutes)"
    echo "5. Test: curl https://your-service.onrender.com/health"
    echo ""
    echo "📖 Full guide: See RENDER_DEPLOYMENT.md"
else
    echo "❌ Deployment cancelled. Run this script again when ready."
fi
