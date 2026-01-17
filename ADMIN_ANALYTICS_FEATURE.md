# Admin Traffic, Activity & Audit Dashboard

## 📋 Overview

The **Admin Traffic, Activity & Audit Dashboard** provides administrators with comprehensive visibility into system usage, member activity, and engagement metrics. This feature is designed for governance, security audits, performance tracking, and donor reporting.

## 🎯 Purpose

- **Monitor System Usage** - Track how members and admins use the platform
- **Security & Compliance** - Detect suspicious activities and maintain audit trails
- **Performance Analysis** - Understand peak usage times and activity patterns
- **Member Engagement** - Identify active and inactive members
- **Audit & Reporting** - Generate comprehensive reports for stakeholders

---

## 🏗️ Architecture

### Backend Components

#### 📦 Models

Located in `backend/models/`:

1. **UserSession.js**
   - Tracks user login/logout sessions
   - Records device type, browser, IP address
   - Calculates session duration
   - Methods: `endSession()`, `getActiveSessions()`, `getLastLogin()`

2. **SearchLog.js**
   - Logs every search performed on the platform
   - Categorizes searches (members, loans, transactions, etc.)
   - Detects suspicious search patterns
   - Methods: `getTopSearches()`, `getSearchesByCategory()`

3. **ActivityLog.js**
   - Comprehensive activity tracking
   - Immutable logs with tamper detection (SHA-256 hash)
   - Tracks deposits, withdrawals, loans, admin actions, etc.
   - Methods: `getMemberTimeline()`, `getActivityStats()`

4. **LoginAttempt.js**
   - Records all login attempts (successful and failed)
   - Tracks failure reasons
   - Identifies suspicious IPs
   - Methods: `getRecentFailedAttempts()`, `getSuspiciousIPs()`

5. **UsageStats.js**
   - Aggregated statistics (daily, weekly, monthly, annual)
   - Pre-calculated metrics for performance
   - Financial and activity summaries

#### 🔧 Middleware

Located in `backend/middleware/`:

1. **activityTracker.js**
   - `trackLoginAttempt()` - Log login attempts
   - `createUserSession()` - Start new session on login
   - `endUserSession()` - End session on logout
   - `logActivity()` - Record any user activity
   - `activityLogger()` - Express middleware for auto-tracking
   - Helper functions: `getClientIP()`, `getDeviceInfo()`

2. **searchTracker.js**
   - `searchTracker()` - Middleware to log search queries
   - Detects suspicious patterns (>20 searches/minute)
   - Auto-cleanup of old tracking data

#### 🛣️ Routes

Located in `backend/routes/analytics.js`:

##### Endpoints

```
GET /api/analytics/dashboard
```
- Returns overview metrics: total users, active sessions, DAU/WAU/MAU
- Provides total logins, searches, transactions
- Shows peak usage times

```
GET /api/analytics/searches?period=week&category=members
```
- Total searches in period
- Top search terms
- Searches by category
- Recent search history
- Suspicious search count

```
GET /api/analytics/logins?period=month
```
- Total and unique logins
- Average session duration
- Logins by role and device type
- Active sessions
- Failed login attempts
- Suspicious IP addresses

```
GET /api/analytics/activities?period=week&userId=xxx
```
- Total activities
- Activities by type
- Recent activities list
- Most active users
- Activity trends over time

```
GET /api/analytics/members/:memberId/timeline
```
- Complete activity timeline for specific member
- Login history
- Search history
- Last login details

```
GET /api/analytics/members/inactive?days=30
```
- List of inactive members
- Days since last login for each

```
GET /api/analytics/usage-stats?period=daily
```
- Aggregated usage statistics
- Historical trends

```
POST /api/analytics/generate-stats
```
- Generate/update usage statistics for specific period
- Requires admin authentication

### Frontend Components

Located in `src/components/admin/`:

#### 🎨 Components

1. **TrafficDashboard.tsx**
   - Main dashboard container
   - Period selector (today, week, month, year)
   - Refresh and export buttons
   - Tab navigation

2. **DashboardOverview.tsx**
   - Summary cards: total users, active sessions, DAU/WAU/MAU
   - Metrics: logins, searches, transactions, failed logins
   - Peak usage time visualization

3. **SearchAnalytics.tsx**
   - Top search terms (ranked)
   - Search distribution by category
   - Recent search history table
   - Suspicious search alerts

4. **LoginAnalytics.tsx**
   - Login metrics and session duration
   - Logins by role and device type
   - Active sessions table
   - Failed login attempts breakdown
   - Suspicious IP addresses alert

5. **ActivityAnalytics.tsx**
   - Activity trends chart (daily volume)
   - Activities breakdown by type
   - Most active users ranking
   - Recent activities table

6. **MemberActivityTimeline.tsx**
   - Search member by ID or phone
   - Visual timeline of all activities
   - Login and search history
   - Last login information

#### 📄 Pages

Located in `src/pages/`:

1. **AdminAnalytics.tsx**
   - Standalone analytics page
   - Integrated navigation
   - Theme toggle support

---

## 🚀 Implementation Guide

### Step 1: Backend Setup

The backend models, middleware, and routes are already created. To integrate into your existing auth flow:

#### Update Auth Routes

In `backend/routes/auth.js`, the following changes have been made:

```javascript
import { trackLoginAttempt, createUserSession } from '../middleware/activityTracker.js';

// On successful login:
await trackLoginAttempt(phone, true, user._id, userModel, req);
const session = await createUserSession(user._id, userModel, role, req);

// On failed login:
await trackLoginAttempt(phone, false, userId, userModel, req, 'invalid_credentials');
```

#### Add Analytics Routes to Server

In `backend/server.js`:

```javascript
import analyticsRoutes from "./routes/analytics.js";
app.use("/api/analytics", analyticsRoutes);
```

### Step 2: Add Activity Tracking to Other Routes

Example for payment routes:

```javascript
import { logActivity, activityLogger } from '../middleware/activityTracker.js';

// Manual logging:
router.post('/deposit', auth, async (req, res) => {
  // ... process deposit ...
  
  await logActivity({
    userId: req.user._id,
    userModel: 'Member',
    activityType: 'deposit',
    description: `Deposit of KES ${amount}`,
    amount,
    status: 'success'
  });
});

// Or use middleware:
router.post('/deposit', 
  auth, 
  activityLogger('deposit', (req, data) => `Deposit of KES ${req.body.amount}`),
  depositController
);
```

### Step 3: Add Search Tracking

```javascript
import { searchTracker } from '../middleware/searchTracker.js';

// Add to search endpoints:
router.get('/search', auth, searchTracker('members'), searchController);
```

### Step 4: Frontend Integration

#### Option A: Add to existing Admin Dashboard

Update your admin navigation to include analytics:

```tsx
import { BarChart3 } from 'lucide-react';

// In admin menu:
<Button onClick={() => navigate('/admin/analytics')}>
  <BarChart3 className="h-4 w-4 mr-2" />
  Analytics & Traffic
</Button>
```

#### Option B: Direct Route

Add route to your router:

```tsx
import AdminAnalytics from '@/pages/AdminAnalytics';

<Route path="/admin/analytics" element={<AdminAnalytics />} />
```

### Step 5: Configure API Authentication

Ensure all analytics endpoints are protected:

```javascript
import { protect, adminOnly } from '../middleware/auth.js';

router.use(protect);      // Require authentication
router.use(adminOnly);    // Admin only access
```

---

## 📊 Features in Detail

### 1. Search Activity Tracking

**What's Tracked:**
- Search term/keyword
- Category (members, loans, transactions, etc.)
- User performing the search
- Results count
- Time and device info
- Suspicious pattern detection

**Use Cases:**
- Understand what members are looking for
- Improve search functionality
- Detect abnormal behavior

### 2. Login & Session Tracking

**What's Tracked:**
- Login/logout timestamps
- Session duration
- Device type and browser
- IP address
- Failed login attempts
- Failure reasons

**Use Cases:**
- Monitor active users
- Detect brute force attacks
- Analyze device preferences
- Track engagement patterns

### 3. Member Activity History

**What's Tracked:**
- All user actions (deposits, withdrawals, loans, etc.)
- Admin actions affecting members
- Profile updates
- Password changes
- Timeline is immutable

**Use Cases:**
- Audit trails for disputes
- Member support
- Compliance reporting
- Performance reviews

### 4. Traffic Dashboard

**Metrics Displayed:**
- Total users
- Active sessions (real-time)
- Daily/Weekly/Monthly Active Users (DAU/WAU/MAU)
- Total logins and searches
- Transaction count
- Peak usage times

**Use Cases:**
- Monitor platform health
- Identify growth trends
- Optimize server resources
- Plan maintenance windows

### 5. Reporting Periods

Supports multiple time ranges:
- **Today** - Current day activity
- **Yesterday** - Previous day summary
- **Week** - Last 7 days
- **Month** - Last 30 days
- **Year** - Last 365 days
- **Custom** - Specific date range

### 6. Usage Statistics Generation

Automated or manual generation of aggregated stats:

```javascript
POST /api/analytics/generate-stats
{
  "period": "daily",   // daily, weekly, monthly, annual
  "date": "2026-01-17"
}
```

This creates pre-calculated summaries for faster reporting.

---

## 🔒 Security & Compliance

### Data Integrity

1. **Immutable Logs**
   - Activity logs cannot be edited after creation
   - Hash verification for tamper detection
   - Soft-archiving only (no hard deletes)

2. **Access Control**
   - All analytics endpoints require authentication
   - Admin-only access
   - Role-based permissions

3. **Privacy**
   - IP addresses stored for security
   - User consent during onboarding
   - Compliant with Kenya Data Protection Act

### Tamper Detection

Each activity log includes a SHA-256 hash:

```javascript
hash = SHA256(userId + activityType + description + timestamp)
```

Any modification attempt will be detected.

---

## 📈 Performance Considerations

### Optimizations

1. **Database Indexes**
   - Compound indexes on commonly queried fields
   - Text indexes for search terms
   - Time-based indexes for date ranges

2. **Aggregation Pipeline**
   - Pre-calculated statistics
   - Efficient MongoDB aggregations
   - Limited result sets

3. **Caching Strategy** (Recommended)
   ```javascript
   // Cache dashboard data for 5 minutes
   const cacheKey = `analytics:dashboard:${period}`;
   const cached = await redis.get(cacheKey);
   if (cached) return JSON.parse(cached);
   
   const data = await fetchDashboardData();
   await redis.setex(cacheKey, 300, JSON.stringify(data));
   ```

### Data Retention

- **Active Data**: Last 90 days (full detail)
- **Archived Data**: 90 days - 3 years (compressed)
- **Summary Stats**: Permanent retention
- **Automatic Cleanup**: Configurable cron job

---

## 🧪 Testing

### Backend Tests

```javascript
// Test login tracking
describe('Activity Tracker', () => {
  it('should create session on successful login', async () => {
    const session = await createUserSession(userId, 'Member', 'member', mockReq);
    expect(session).toBeDefined();
    expect(session.isActive).toBe(true);
  });

  it('should log failed login attempt', async () => {
    await trackLoginAttempt('0712345678', false, null, null, mockReq, 'invalid_credentials');
    const attempts = await LoginAttempt.find({ identifier: '0712345678', success: false });
    expect(attempts.length).toBeGreaterThan(0);
  });
});
```

### Frontend Tests

```jsx
// Test dashboard rendering
describe('TrafficDashboard', () => {
  it('should render overview metrics', () => {
    render(<DashboardOverview data={mockData} />);
    expect(screen.getByText('Total Users')).toBeInTheDocument();
    expect(screen.getByText('Active Sessions')).toBeInTheDocument();
  });
});
```

---

## 🎓 Usage Examples

### Example 1: View System Overview

1. Navigate to Admin Dashboard
2. Click "Analytics & Traffic"
3. Select period (e.g., "Last 7 Days")
4. View overview metrics

### Example 2: Investigate Suspicious Activity

1. Go to "Logins & Sessions" tab
2. Scroll to "Suspicious IP Addresses"
3. Note IPs with multiple failed attempts
4. Cross-reference with login attempts table

### Example 3: Generate Monthly Report

1. Select "Last 30 Days" period
2. Review all tabs for comprehensive data
3. Click "Export" → "CSV"
4. Generate report for stakeholders

### Example 4: Check Member Activity

1. Go to "Activity Timeline" tab
2. Enter member ID or phone number
3. Review complete activity history
4. Note login patterns and actions

---

## 📝 Future Enhancements

### Planned Features

- [ ] Real-time alerts (WebSocket notifications)
- [ ] Predictive analytics (ML-based)
- [ ] Heatmap visualizations
- [ ] Admin performance tracking
- [ ] Automated anomaly detection
- [ ] Email digest reports
- [ ] Custom dashboard widgets
- [ ] Role-specific analytics views
- [ ] Mobile app analytics
- [ ] API usage tracking

### Export Improvements

```javascript
// To be implemented
GET /api/analytics/export?format=pdf&period=month
GET /api/analytics/export?format=excel&period=week
```

Features:
- PDF reports with charts
- Excel with multiple sheets
- Scheduled email reports
- Custom report templates

---

## 🐛 Troubleshooting

### Common Issues

**Issue**: Analytics not loading
- **Solution**: Check if analytics routes are registered in server.js
- **Solution**: Verify admin token is valid

**Issue**: Empty timeline for member
- **Solution**: Ensure member ID is correct
- **Solution**: Check if member has any recent activity

**Issue**: Suspicious searches showing 0
- **Solution**: This is normal if no suspicious patterns detected
- **Solution**: Threshold is >20 searches per minute

**Issue**: Peak usage showing null
- **Solution**: No logins in selected period
- **Solution**: Select broader time range

---

## 📞 Support

For questions or issues:
- Review this documentation
- Check backend logs for errors
- Verify database connections
- Ensure models are properly registered
- Test API endpoints with Postman/Insomnia

---

## 🎉 Summary

The Admin Traffic & Analytics Dashboard provides:

✅ **Comprehensive Monitoring** - Track all user activities
✅ **Security Features** - Detect and prevent unauthorized access  
✅ **Audit Trails** - Immutable logs for compliance
✅ **Performance Insights** - Understand usage patterns
✅ **Member Engagement** - Identify active/inactive users
✅ **Flexible Reporting** - Multiple time periods and export options
✅ **Scalable Architecture** - Optimized for performance
✅ **Privacy Compliant** - Meets data protection standards

This feature empowers administrators with data-driven insights for better governance and decision-making.

---

**Last Updated**: January 17, 2026
**Version**: 1.0.0
