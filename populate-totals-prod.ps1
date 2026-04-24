#!/usr/bin/env pwsh

Write-Host "`n🔧 Populating Member Totals in Production`n" -ForegroundColor Cyan

# Change to backend directory
Set-Location "backend"

Write-Host "📦 Running safe population script via Render SSH..." -ForegroundColor Yellow
Write-Host ""
Write-Host "⚠️  This script processes members in batches to handle timeout issues" -ForegroundColor Yellow
Write-Host ""

# Execute the script through git push and then trigger via API or SSH
Write-Host "Option 1: Run locally with production MongoDB URI" -ForegroundColor Green
Write-Host "  node scripts/populate-member-totals-safe.js" -ForegroundColor White
Write-Host ""
Write-Host "Option 2: Trigger via API endpoint (after deploying)" -ForegroundColor Green  
Write-Host "  curl -X POST https://smcf-c99o.onrender.com/api/members/recalculate-totals \" -ForegroundColor White
Write-Host "    -H 'Authorization: Bearer YOUR_ADMIN_TOKEN'" -ForegroundColor White
Write-Host ""
Write-Host "Option 3: Run on Render via SSH" -ForegroundColor Green
Write-Host "  1. Go to https://dashboard.render.com" -ForegroundColor White
Write-Host "  2. Select your smcf backend service" -ForegroundColor White
Write-Host "  3. Click 'Shell' tab" -ForegroundColor White
Write-Host "  4. Run: node backend/scripts/populate-member-totals-safe.js" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Run locally with production credentials? (y/n)"

if ($choice -eq 'y' -or $choice -eq 'Y') {
    Write-Host "`n🚀 Executing script locally..." -ForegroundColor Cyan
    node scripts/populate-member-totals-safe.js
} else {
    Write-Host "`nℹ️  Script not executed. Use one of the options above." -ForegroundColor Yellow
}

Set-Location ..
Write-Host "`n✅ Done`n" -ForegroundColor Green
