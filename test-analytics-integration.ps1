# SMCF Analytics Dashboard Integration Test
# PowerShell version

Write-Host "SMCF Analytics Dashboard Integration Test" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

$PASSED = 0
$FAILED = 0

function Test-FileExists {
    param(
        [string]$Path,
        [string]$Description
    )
    
    if (Test-Path $Path) {
        Write-Host "[OK] $Description" -ForegroundColor Green
        $script:PASSED++
    } else {
        Write-Host "[FAIL] $Description - File missing: $Path" -ForegroundColor Red
        $script:FAILED++
    }
}

Write-Host "📁 Checking Backend Files..." -ForegroundColor Yellow
Test-FileExists "smcf\backend\models\UserSession.js" "UserSession Model"
Test-FileExists "smcf\backend\models\SearchLog.js" "SearchLog Model"
Test-FileExists "smcf\backend\models\ActivityLog.js" "ActivityLog Model"
Test-FileExists "smcf\backend\models\LoginAttempt.js" "LoginAttempt Model"
Test-FileExists "smcf\backend\models\UsageStats.js" "UsageStats Model"
Test-FileExists "smcf\backend\middleware\activityTracker.js" "Activity Tracker Middleware"
Test-FileExists "smcf\backend\middleware\searchTracker.js" "Search Tracker Middleware"
Test-FileExists "smcf\backend\routes\analytics.js" "Analytics Routes"

Write-Host ""
Write-Host "📁 Checking Frontend Files..." -ForegroundColor Yellow
Test-FileExists "smcf\src\components\admin\TrafficDashboard.tsx" "Traffic Dashboard"
Test-FileExists "smcf\src\components\admin\DashboardOverview.tsx" "Dashboard Overview"
Test-FileExists "smcf\src\components\admin\SearchAnalytics.tsx" "Search Analytics"
Test-FileExists "smcf\src\components\admin\LoginAnalytics.tsx" "Login Analytics"
Test-FileExists "smcf\src\components\admin\ActivityAnalytics.tsx" "Activity Analytics"
Test-FileExists "smcf\src\components\admin\MemberActivityTimeline.tsx" "Member Timeline"
Test-FileExists "smcf\src\pages\AdminAnalytics.tsx" "Admin Analytics Page"

Write-Host ""
Write-Host "📁 Checking Documentation..." -ForegroundColor Yellow
Test-FileExists "smcf\ADMIN_ANALYTICS_FEATURE.md" "Feature Documentation"
Test-FileExists "smcf\ANALYTICS_SETUP_GUIDE.md" "Setup Guide"

Write-Host ""
Write-Host "🔍 Checking Integration Points..." -ForegroundColor Yellow

# Check if analytics routes are registered in server.js
if (Select-String -Path "smcf\backend\server.js" -Pattern "analyticsRoutes" -Quiet) {
    Write-Host "[OK] Analytics routes registered in server.js" -ForegroundColor Green
    $PASSED++
} else {
    Write-Host "[FAIL] Analytics routes NOT registered in server.js" -ForegroundColor Red
    $FAILED++
}

# Check if auth tracking is integrated
if (Select-String -Path "smcf\backend\routes\auth.js" -Pattern "trackLoginAttempt" -Quiet) {
    Write-Host "[OK] Login tracking integrated in auth routes" -ForegroundColor Green
    $PASSED++
} else {
    Write-Host "[FAIL] Login tracking NOT integrated in auth routes" -ForegroundColor Red
    $FAILED++
}

# Check if TrafficDashboard is imported in AdminDashboard
if (Select-String -Path "smcf\src\components\AdminDashboard.tsx" -Pattern "TrafficDashboard" -Quiet) {
    Write-Host "[OK] TrafficDashboard imported in AdminDashboard" -ForegroundColor Green
    $PASSED++
} else {
    Write-Host "[FAIL] TrafficDashboard NOT imported in AdminDashboard" -ForegroundColor Red
    $FAILED++
}

# Check if Analytics button exists
if (Select-String -Path "smcf\src\components\AdminDashboard.tsx" -Pattern "BarChart3" -Quiet) {
    Write-Host "[OK] Analytics button added to admin interface" -ForegroundColor Green
    $PASSED++
} else {
    Write-Host "[FAIL] Analytics button NOT added" -ForegroundColor Red
    $FAILED++
}

Write-Host ""
Write-Host "Checking Dependencies..." -ForegroundColor Yellow

# Check if package.json has required dependencies
$packageJson = Get-Content "smcf\package.json" -Raw
if (($packageJson -match "date-fns") -and ($packageJson -match "recharts")) {
    Write-Host "[OK] Required npm packages are installed" -ForegroundColor Green
    $PASSED++
} else {
    Write-Host "[WARN] Missing dependencies" -ForegroundColor Yellow
    $FAILED++
}

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "Test Results: " -NoNewline
Write-Host "$PASSED passed" -ForegroundColor Green -NoNewline
Write-Host ", " -NoNewline
Write-Host "$FAILED failed" -ForegroundColor Red
Write-Host ""

if ($FAILED -eq 0) {
    Write-Host "SUCCESS: All integration tests passed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Cyan
    Write-Host "1. Start backend: cd smcf\backend; npm start"
    Write-Host "2. Start frontend: cd smcf; npm run dev"
    Write-Host "3. Login as admin and click the 'Analytics' button"
    Write-Host "4. Review ANALYTICS_SETUP_GUIDE.md for detailed instructions"
    exit 0
} else {
    Write-Host "FAILED: Some integration tests failed. Please review the output above." -ForegroundColor Red
    exit 1
}
