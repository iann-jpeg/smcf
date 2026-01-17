# Quick Setup Guide - Admin Analytics Dashboard

## ✅ What Has Been Created

### Backend (ES Modules format)
- ✅ 5 Mongoose Models (UserSession, SearchLog, ActivityLog, LoginAttempt, UsageStats)
- ✅ 2 Middleware files (activityTracker, searchTracker)
- ✅ 1 Analytics routes file with 8 endpoints
- ✅ Auth routes updated with tracking

### Frontend (React + TypeScript)
- ✅ 6 Analytics components
- ✅ 1 Admin Analytics page
- ✅ Full UI with charts and tables

### Documentation
- ✅ Comprehensive feature documentation (ADMIN_ANALYTICS_FEATURE.md)

---

## 🚀 Quick Integration Steps

### Step 1: Install Missing Dependencies (if needed)

```bash
cd smcf
npm install date-fns recharts
```

### Step 2: Add Navigation to Admin Dashboard

Open `src/components/AdminDashboard.tsx` and add this navigation item:

```tsx
import { BarChart3 } from 'lucide-react';

// Add in your navigation menu:
<Button 
  onClick={() => {
    // Navigate to analytics - adjust based on your routing
    window.location.href = '/admin/analytics';
  }}
  variant="outline"
  className="w-full justify-start"
>
  <BarChart3 className="h-4 w-4 mr-2" />
  Traffic & Analytics
</Button>
```

### Step 3: Add Route (if using React Router)

In your main routing file (e.g., `src/App.tsx`):

```tsx
import AdminAnalytics from '@/pages/AdminAnalytics';

// Add route:
<Route path="/admin/analytics" element={<AdminAnalytics />} />
```

### Step 4: Test the Backend

Start your backend server:

```bash
cd smcf/backend
npm start
```

Test an endpoint:
```bash
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  http://localhost:4000/api/analytics/dashboard?period=week
```

### Step 5: Test the Frontend

Start your frontend:

```bash
cd smcf
npm run dev
```

Navigate to `/admin/analytics` and verify the dashboard loads.

---

## 🔧 Configuration Options

### Customize Tracking Behavior

In `backend/middleware/searchTracker.js`, adjust suspicious search threshold:

```javascript
// Current: 20 searches per minute
// Change to your preference:
return recentUserSearches.length > 50; // More lenient
```

### Adjust Session Timeout

In your auth middleware or session config:

```javascript
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
```

### Data Retention Policy

Create a cleanup cron job in `backend/services/cleanupService.js`:

```javascript
import cron from 'node-cron';
import ActivityLog from '../models/ActivityLog.js';

// Archive logs older than 3 years
cron.schedule('0 0 * * *', async () => {
  const threeYearsAgo = new Date();
  threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
  
  await ActivityLog.updateMany(
    { createdAt: { $lt: threeYearsAgo }, archived: false },
    { $set: { archived: true } }
  );
});
```

---

## 📊 Usage Statistics Generation

### Manual Generation

To generate usage stats for a specific period:

```javascript
POST /api/analytics/generate-stats
Content-Type: application/json
Authorization: Bearer YOUR_ADMIN_TOKEN

{
  "period": "daily",
  "date": "2026-01-17"
}
```

### Automated Generation (Recommended)

Add to `backend/services/statsGenerationService.js`:

```javascript
import cron from 'node-cron';
import { generateDailyStats, generateWeeklyStats, generateMonthlyStats } from '../controllers/analyticsController.js';

// Generate daily stats at midnight
cron.schedule('0 0 * * *', async () => {
  await generateDailyStats(new Date());
});

// Generate weekly stats on Mondays
cron.schedule('0 0 * * 1', async () => {
  await generateWeeklyStats(new Date());
});

// Generate monthly stats on 1st of month
cron.schedule('0 0 1 * *', async () => {
  await generateMonthlyStats(new Date());
});
```

---

## 🎯 Next Steps

### Immediate Actions

1. **Test Login Tracking**
   - Log in as admin
   - Check `UserSession` collection
   - Verify `LoginAttempt` records

2. **Test Activity Logging**
   - Make a deposit or loan application
   - Check `ActivityLog` collection
   - View in Activity Timeline

3. **Test Search Tracking**
   - Search for members
   - Check `SearchLog` collection
   - View in Search Analytics tab

### Future Enhancements

- **Export Functionality** - Add PDF/Excel export handlers
- **Real-time Updates** - Integrate WebSocket for live metrics
- **Email Reports** - Schedule automated email digests
- **Custom Alerts** - Set up notifications for suspicious activity
- **Mobile View** - Optimize dashboard for mobile devices

---

## 🐛 Troubleshooting

### Database Connection Issues

If models aren't registered:

```javascript
// In backend/server.js, ensure models are imported
import UserSession from './models/UserSession.js';
import SearchLog from './models/SearchLog.js';
import ActivityLog from './models/ActivityLog.js';
import LoginAttempt from './models/LoginAttempt.js';
import UsageStats from './models/UsageStats.js';
```

### Frontend Build Errors

If you get import errors:

```bash
# Install missing types
npm install --save-dev @types/recharts
```

### API 404 Errors

Verify analytics routes are registered in `backend/server.js`:

```javascript
import analyticsRoutes from "./routes/analytics.js";
app.use("/api/analytics", analyticsRoutes);
```

---

## 📚 Resources

- **Full Documentation**: See `ADMIN_ANALYTICS_FEATURE.md`
- **API Reference**: Check `backend/routes/analytics.js` for all endpoints
- **Component Docs**: Each component has inline documentation

---

## ✨ Features Summary

Your admin panel now has:

- 📊 **Dashboard Overview** - Total users, active sessions, DAU/WAU/MAU
- 🔍 **Search Analytics** - Top searches, categories, suspicious patterns
- 🔐 **Login Tracking** - Sessions, devices, failed attempts, suspicious IPs
- 📝 **Activity Logs** - Complete timeline of all actions
- 👤 **Member Timeline** - Individual activity history per member
- 📈 **Trends & Charts** - Visual representation of data
- 📅 **Flexible Periods** - Today, week, month, year, custom ranges
- 🔒 **Security Features** - Immutable logs, tamper detection, audit trails

---

**Ready to use!** Access at `/admin/analytics` after adding navigation.

For questions, refer to the comprehensive documentation in `ADMIN_ANALYTICS_FEATURE.md`.
