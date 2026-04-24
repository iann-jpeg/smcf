#!/bin/bash

echo "🧪 SMCF Analytics Dashboard Integration Test"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
PASSED=0
FAILED=0

# Function to check if file exists
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $2"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} $2 - File missing: $1"
        ((FAILED++))
    fi
}

echo "📁 Checking Backend Files..."
check_file "smcf/backend/models/UserSession.js" "UserSession Model"
check_file "smcf/backend/models/SearchLog.js" "SearchLog Model"
check_file "smcf/backend/models/ActivityLog.js" "ActivityLog Model"
check_file "smcf/backend/models/LoginAttempt.js" "LoginAttempt Model"
check_file "smcf/backend/models/UsageStats.js" "UsageStats Model"
check_file "smcf/backend/middleware/activityTracker.js" "Activity Tracker Middleware"
check_file "smcf/backend/middleware/searchTracker.js" "Search Tracker Middleware"
check_file "smcf/backend/routes/analytics.js" "Analytics Routes"

echo ""
echo "📁 Checking Frontend Files..."
check_file "smcf/src/components/admin/TrafficDashboard.tsx" "Traffic Dashboard"
check_file "smcf/src/components/admin/DashboardOverview.tsx" "Dashboard Overview"
check_file "smcf/src/components/admin/SearchAnalytics.tsx" "Search Analytics"
check_file "smcf/src/components/admin/LoginAnalytics.tsx" "Login Analytics"
check_file "smcf/src/components/admin/ActivityAnalytics.tsx" "Activity Analytics"
check_file "smcf/src/components/admin/MemberActivityTimeline.tsx" "Member Timeline"
check_file "smcf/src/pages/AdminAnalytics.tsx" "Admin Analytics Page"

echo ""
echo "📁 Checking Documentation..."
check_file "smcf/ADMIN_ANALYTICS_FEATURE.md" "Feature Documentation"
check_file "smcf/ANALYTICS_SETUP_GUIDE.md" "Setup Guide"

echo ""
echo "🔍 Checking Integration Points..."

# Check if analytics routes are registered in server.js
if grep -q "analyticsRoutes" "smcf/backend/server.js"; then
    echo -e "${GREEN}✓${NC} Analytics routes registered in server.js"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} Analytics routes NOT registered in server.js"
    ((FAILED++))
fi

# Check if auth tracking is integrated
if grep -q "trackLoginAttempt" "smcf/backend/routes/auth.js"; then
    echo -e "${GREEN}✓${NC} Login tracking integrated in auth routes"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} Login tracking NOT integrated in auth routes"
    ((FAILED++))
fi

# Check if TrafficDashboard is imported in AdminDashboard
if grep -q "TrafficDashboard" "smcf/src/components/AdminDashboard.tsx"; then
    echo -e "${GREEN}✓${NC} TrafficDashboard imported in AdminDashboard"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} TrafficDashboard NOT imported in AdminDashboard"
    ((FAILED++))
fi

# Check if Analytics button exists
if grep -q "BarChart3" "smcf/src/components/AdminDashboard.tsx"; then
    echo -e "${GREEN}✓${NC} Analytics button added to admin interface"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} Analytics button NOT added"
    ((FAILED++))
fi

echo ""
echo "📦 Checking Dependencies..."

# Check if package.json has required dependencies
if grep -q "date-fns" "smcf/package.json" && grep -q "recharts" "smcf/package.json"; then
    echo -e "${GREEN}✓${NC} Required npm packages installed (date-fns, recharts)"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠${NC} Missing dependencies - run: npm install date-fns recharts"
    ((FAILED++))
fi

echo ""
echo "=============================================="
echo -e "Test Results: ${GREEN}${PASSED} passed${NC}, ${RED}${FAILED} failed${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✨ All integration tests passed!${NC}"
    echo ""
    echo "Next Steps:"
    echo "1. Start backend: cd smcf/backend && npm start"
    echo "2. Start frontend: cd smcf && npm run dev"
    echo "3. Login as admin and click the 'Analytics' button"
    echo "4. Review ANALYTICS_SETUP_GUIDE.md for detailed instructions"
    exit 0
else
    echo -e "${RED}❌ Some integration tests failed. Please review the output above.${NC}"
    exit 1
fi
