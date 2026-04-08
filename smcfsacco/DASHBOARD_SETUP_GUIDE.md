# Role-Based Dashboard - Complete Setup Guide

## ✅ Implementation Status: COMPLETE

The role-based dashboard system has been fully implemented and is ready for testing.

---

## Quick Start

### 1. Start Backend Server
```bash
cd smcf-sacco-backend
npm install  # if not already done
npm start
```

### 2. Test Dashboard Endpoint
```bash
# Replace TOKEN with actual JWT token from login
curl -X GET http://localhost:3000/api/dashboard/stats \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json"
```

### 3. Check Which Role You Are
The response will include:
```json
{
  "success": true,
  "role": "admin|credit_officer|credit_committee|treasurer|auditor",
  "data": { ... }
}
```

---

## What's New

### Dashboard Endpoint: `/api/dashboard/stats`
**Method:** GET  
**Auth:** Required (Bearer token)  
**Authorization:** Must have one of: admin, credit_officer, credit_committee, treasurer, auditor

#### Response by Role:

**Admin** - See all data:
```json
{
  "totalMembers": 150,
  "totalSavings": 500000,
  "totalShares": 300000,
  "activeLoans": 45,
  "totalLoanBalance": 250000,
  "pendingLoans": 5,
  "defaultRate": 3.5,
  "activeGuarantees": 120
}
```

**Credit Officer** - See member registrations:
```json
{
  "totalMembers": 150,
  "newMembers": 12,
  "pendingLoans": 5,
  "recentApplications": [...]
}
```

**Credit Committee** - See loan approvals:
```json
{
  "pendingApprovals": 5,
  "approvedLoans": 40,
  "rejectedLoans": 2,
  "pendingForReview": [...]
}
```

**Treasurer** - See financial data:
```json
{
  "totalSavings": 500000,
  "totalShares": 300000,
  "monthlyTransactions": 85000,
  "recentTransactions": [...]
}
```

**Auditor** - See compliance data:
```json
{
  "auditLogsCount": 523,
  "recentAuditLogs": [...],
  "defaultRate": 3.5,
  "riskMetrics": { ... }
}
```

---

## Growth Endpoint (Optional): `/api/dashboard/growth`
**Method:** GET  
**Query Param:** `?months=6` (default: 6 months)  
**Authorization:** Same as stats endpoint

Returns growth statistics based on role.

---

## User Roles Available

| Role | Database Value | Permissions |
|------|---|---|
| Admin | `admin` | All dashboard data |
| Credit Officer | `credit_officer` | Members + Applications |
| Credit Committee | `credit_committee` | Loan Approvals |
| Treasurer | `treasurer` | Financial Data |
| Auditor | `auditor` | Compliance + Risk |
| Member | `member` | No dashboard access |

---

## Testing Dashboard

### Create a Test User with Admin Role
```bash
# Database: Direct MongoDB insert
db.users.insertOne({
  email: "admin@sacco.test",
  password: "hashed_password_here",
  fullName: "Admin User",
  roles: ["admin"],
  isEmailVerified: true,
  createdAt: new Date()
})
```

### Test with Different Roles
1. Change user.roles to test different roles
2. Login and get JWT token
3. Call `/api/dashboard/stats` with token
4. Verify different data is returned for each role

### Error Scenarios to Test
```
# No token
curl http://localhost:3000/api/dashboard/stats
→ 401: "Not authorized to access this route"

# Invalid token
curl http://localhost:3000/api/dashboard/stats \
  -H "Authorization: Bearer invalid"
→ 401: "Not authorized to access this route"

# Member role (no permission)
# User has role: ["member"]
→ 403: "User role is not authorized to access this route"

# Multiple roles (e.g., ["credit_officer", "treasurer"])
# Should see combined/highest privileged data
→ 200: Returns appropriate role-specific data
```

---

## Code Changes Summary

### Modified Files
- **src/routes/dashboard.ts** - Complete rewrite with role-based logic

### Key Changes
```typescript
// OLD: Single generic endpoint
router.get('/stats', protect, authorize(...), async (req, res) => {
  // All users got same data
})

// NEW: Role-based conditional logic
router.get('/stats', protect, authorize(...), async (req: AuthRequest, res) => {
  const userRoles = (req.user as any)?.roles || [];
  
  if (userRoles.includes('admin')) {
    // Return admin data
  } else if (userRoles.includes('credit_officer')) {
    // Return credit officer data
  } else if (...) {
    // Return other role data
  }
})
```

---

## Error Messages You Might See

| Error | Reason | Solution |
|-------|--------|----------|
| `Not authorized to access this route` | No/invalid JWT token | Check Authorization header, re-login |
| `User role is not authorized` | Role doesn't have permission | Assign user correct role |
| `Role not recognized` | User roles array is empty | Add at least one valid role |
| `Cannot read property 'roles'` | User object is null | Token user lookup failed |

---

## Database Requirements

### Collections Needed
- ✅ `users` - Has `roles` field (array of strings)
- ✅ `members` - Has `status`, `savings`, `shares`, `loanBalance`, `createdAt`
- ✅ `loans` - Has `status`, `principal`, `appliedAt`, `approvedAt`, `disbursedDate`
- ✅ `transactions` - Has `memberId`, `amount`, `processedAt`
- ✅ `auditlogs` - Has `userId`, `action`, `createdAt`

### Optional Indexes (for performance)
```javascript
// Add to MongoDB if performance is slow
db.members.createIndex({ status: 1, createdAt: -1 });
db.loans.createIndex({ status: 1, appliedAt: -1 });
db.transactions.createIndex({ processedAt: -1 });
db.auditlogs.createIndex({ createdAt: -1 });
```

---

## Frontend Next Steps

### 1. Update Dashboard Component
Check props/state handling for different role types:
```typescript
// Dashboard.tsx or similar
const { role, data } = await fetchDashboard();

switch(role) {
  case 'admin': return <AdminDashboard data={data} />;
  case 'credit_officer': return <CreditOfficerDashboard data={data} />;
  case 'credit_committee': return <CreditCommitteeDashboard data={data} />;
  case 'treasurer': return <TreasurerDashboard data={data} />;
  case 'auditor': return <AuditorDashboard data={data} />;
}
```

### 2. Handle Missing Data
Some roles get less data. Add guards:
```typescript
if (data.totalMembers !== undefined) {
  // Render members card
}
```

### 3. Test with Real Auth
Make sure frontend sends JWT token in requests:
```typescript
const token = localStorage.getItem('authToken');
const response = await fetch('/api/dashboard/stats', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

---

## Monitoring & Maintenance

### What to Monitor
- Response times for each role (should be <500ms)
- Error rates (401/403 should be <1%)
- Database query performance
- Token validation times

### Common Issues & Fixes

**Slow Dashboard:**
1. Add database indexes
2. Reduce data in populate() calls
3. Implement response caching

**Users Seeing Wrong Data:**
1. Clear browser cache
2. Re-login to refresh token
3. Verify user role in database

**Role Not Working:**
1. Check role name matches enum: admin, credit_officer, credit_committee, treasurer, auditor
2. Verify role is in user.roles array
3. Check middleware is applied to route

---

## API Documentation

### Endpoint: `/api/dashboard/stats`

```
GET /api/dashboard/stats
Authorization: Bearer {jwt_token}

Response (200 OK):
{
  "success": true,
  "role": "admin|credit_officer|...",
  "data": { ... }
}

Errors:
- 401: Invalid/missing token
- 403: User lacks required role
- 500: Server error
```

### Endpoint: `/api/dashboard/growth`

```
GET /api/dashboard/growth?months=6
Authorization: Bearer {jwt_token}

Query Parameters:
- months: number (optional, default: 6)

Response (200 OK):
{
  "success": true,
  "role": "...",
  "data": {
    "memberGrowth": [...],
    "loanGrowth": [...],
    ...
  }
}
```

---

## Production Checklist

- [ ] JWT_SECRET is set in .env (not hardcoded)
- [ ] Database indexes are created
- [ ] Error logging is enabled
- [ ] Rate limiting on auth endpoints
- [ ] HTTPS enabled for all API calls
- [ ] CORS properly configured
- [ ] Test with real user data
- [ ] Create staff users with correct roles
- [ ] Database backups configured
- [ ] Monitoring/alerts set up

---

## Need Help?

1. **API isn't returning expected data?**
   - Check user role in database
   - Verify JWT token is valid
   - Check database has sample data

2. **Getting 403 errors?**
   - User role is not authorized for that endpoint
   - Assign user the correct role

3. **Frontend not showing dashboard?**
   - Verify API response structure matches expectations
   - Check localStorage for auth token
   - Open developer console for network errors

4. **Performance issues?**
   - Create recommended database indexes
   - Check MongoDB explain plans for slow queries
   - Consider implementing caching
