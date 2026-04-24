# PowerShell script to deploy SMCF Backend to Render

Write-Host "`n🚀 Deploying SMCF Backend to Render" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host ""

# Check if we're in a git repository
try {
    git rev-parse --git-dir 2>&1 | Out-Null
} catch {
    Write-Host "❌ Not a git repository. Please run 'git init' first." -ForegroundColor Red
    exit 1
}

Write-Host "📋 Files changed for Render deployment:" -ForegroundColor Cyan
Write-Host "  - render.yaml (new)"
Write-Host "  - .node-version (new)"
Write-Host "  - .nvmrc (new)"
Write-Host "  - Procfile (new)"
Write-Host "  - backend/server.js (updated)"
Write-Host "  - backend/package.json (updated)"
Write-Host "  - backend/routes/auth.js (updated)"
Write-Host "  - RENDER_DEPLOYMENT.md (new)"
Write-Host "  - RENDER_FIX_SUMMARY.md (new)"
Write-Host ""

# Show git status
Write-Host "📊 Git Status:" -ForegroundColor Cyan
git status --short

Write-Host ""
$response = Read-Host "Do you want to commit and push these changes? (y/n)"

if ($response -eq "y" -or $response -eq "Y") {
    Write-Host "`n✅ Adding files to git..." -ForegroundColor Green
    git add render.yaml .node-version .nvmrc Procfile backend/server.js backend/package.json backend/routes/auth.js RENDER_DEPLOYMENT.md RENDER_FIX_SUMMARY.md verify-deployment.sh deploy-to-render.sh deploy-to-render.ps1
    
    Write-Host "✅ Committing changes..." -ForegroundColor Green
    git commit -m "Fix Render deployment: Add proper configuration and error handling

- Add render.yaml for automatic Render deployment
- Specify Node.js version with .node-version and .nvmrc
- Add health check endpoints
- Improve MongoDB connection error handling
- Add graceful shutdown for production
- Enhanced startup logging for debugging
- Add comprehensive deployment documentation"
    
    Write-Host "✅ Pushing to GitHub..." -ForegroundColor Green
    git push origin main
    
    Write-Host ""
    Write-Host "✅ Changes pushed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 Next Steps:" -ForegroundColor Yellow
    Write-Host "1. Go to Render Dashboard: https://dashboard.render.com/"
    Write-Host "2. Create new Web Service from your GitHub repo (or it will auto-deploy)"
    Write-Host "3. Set environment variables:" -ForegroundColor Cyan
    Write-Host "   - MONGODB_URI"
    Write-Host "   - JWT_SECRET"
    Write-Host "   - CLIENT_URL"
    Write-Host "   - ADMIN_PHONE"
    Write-Host "   - LIPIA_API_KEY"
    Write-Host "   - LIPIA_APP_ID"
    Write-Host "4. Wait for deployment to complete (~2-3 minutes)"
    Write-Host "5. Test: curl https://your-service.onrender.com/health"
    Write-Host ""
    Write-Host "📖 Full guide: See RENDER_DEPLOYMENT.md" -ForegroundColor Cyan
} else {
    Write-Host "`n❌ Deployment cancelled. Run this script again when ready." -ForegroundColor Red
}
