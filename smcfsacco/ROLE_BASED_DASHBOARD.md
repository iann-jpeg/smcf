# Role-Based Dashboard Implementation

## Overview
The dashboard system has been updated to return **role-specific data** for each staff member. This ensures that each role only sees data relevant to their responsibilities, improving security and user experience.

---

## Dashboard Endpoints

### 1. **GET /api/dashboard/stats** - Main Statistics
Returns different statistics based on user role.

#### **ADMIN Dashboard**
```json
{
  "role": "admin",
  "data": {
    "totalMembers": 150,
    "totalSavings": 500000,
    "totalShares": 300000,
    "activeLoans": 45,
    "totalLoanBalance": 250000,
    "pendingLoans": 5,
    "defaultRate": 3.5,
    "activeGuarantees": 120
  }
}
```
- **Sees:** All member data, all loan data, all financial data
- **Purpose:** Complete oversight of SACCO operations

---

#### **CREDIT OFFICER Dashboard**
```json
{
  "role": "credit_officer",
  "data": {
    "totalMembers": 150,
    "newMembers": 12,
    "pendingLoans": 5,
    "recentApplications": [
      {
        "_id": "loan123",
        "memberId": { "name": "John Doe", "memberId": "M001" },
        "appliedAt": "2025-01-15T10:30:00Z"
      }
    ],
    "message": "Manage member registrations and loan applications"
  }
}
```
- **Sees:** Member registrations, pending loan applications, new members (last 30 days)
- **Purpose:** Register new members and review loan applications

---

#### **CREDIT COMMITTEE Dashboard**
```json
{
  "role": "credit_committee",
  "data": {
    "pendingApprovals": 5,
    "approvedLoans": 40,
    "rejectedLoans": 2,
    "pendingForReview": [
      {
        "_id": "loan123",
        "memberId": { "name": "John Doe", "memberId": "M001" },
        "appliedAt": "2025-01-15T10:30:00Z"
      }
    ],
    "message": "Review and approve loan applications"
  }
}
```
- **Sees:** Pending approvals, approved loans, rejected loans, loan details
- **Purpose:** Review and approve/reject loan applications

---

#### **TREASURER Dashboard**
```json
{
  "role": "treasurer",
  "data": {
    "totalSavings": 500000,
    "totalShares": 300000,
    "monthlyTransactions": 85000,
    "recentTransactions": [
      {
        "_id": "txn456",
        "memberId": { "name": "Jane Doe", "memberId": "M002" },
        "amount": 5000,
        "processedAt": "2025-01-20T14:20:00Z"
      }
    ],
    "message": "Manage accounts, ledger, and financial transactions"
  }
}
```
- **Sees:** Total savings, shares, transactions (last 30 days), recent transactions
- **Purpose:** Manage financial accounts and transactions

---

#### **AUDITOR Dashboard**
```json
{
  "role": "auditor",
  "data": {
    "auditLogsCount": 523,
    "recentAuditLogs": [
      {
        "_id": "log789",
        "userId": { "email": "credit@sacco.com", "fullName": "Credit Officer" },
        "action": "loan_application_submitted",
        "createdAt": "2025-01-20T15:45:00Z"
      }
    ],
    "defaultRate": 3.5,
    "riskMetrics": {
      "defaultedLoans": 2,
      "totalDisbursed": 57
    },
    "message": "Audit logs, compliance, and risk assessment"
  }
}
```
- **Sees:** Audit logs, compliance data, default rate, risk metrics
- **Purpose:** Monitor compliance and assess risks

---

### 2. **GET /api/dashboard/growth** - Growth Statistics (Optional)
Returns growth trends based on user role.

#### **ADMIN & TREASURER**
- Member growth over time
- Loan disbursement growth over time
- Query param: `?months=6` (default: 6 months)

#### **CREDIT OFFICER**
- New member registrations over time

#### **CREDIT COMMITTEE**
- Loan approval trends over time

#### **AUDITOR**
- Default rate trends over time

---

## Role Definitions

| Role | Responsibilities | Dashboard Access |
|------|-----------------|------------------|
| **admin** | System administration | All data |
| **credit_officer** | Register members, manage applications | Members, pending loans |
| **credit_committee** | Approve/reject loans | Loan approvals, pending approvals |
| **treasurer** | Manage finances | Savings, shares, transactions |
| **auditor** | Compliance and risk | Audit logs, risk metrics |

---

## Security Features

1. **Role-Based Access Control (RBAC)**
   - Each endpoint checks user roles using `authorize()` middleware
   - Returns 403 Forbidden if user lacks required role

2. **Data Filtering**
   - Each role only receives data relevant to their job function
   - Sensitive information is hidden from unauthorized roles

3. **Audit Logging**
   - All dashboard accesses are logged for compliance
   - Helps track who accessed what data and when

---

## Implementation Details

### Backend Changes
- **File:** [src/routes/dashboard.ts](src/routes/dashboard.ts)
- **Type:** TypeScript/Express
- **Middleware:** `protect` (authentication) + `authorize` (role-based)

### Key Features
✅ Role-based data filtering
✅ Parallel data aggregation (performance optimized)
✅ Error handling
✅ Type-safe implementation
✅ Audit trail ready

### Database Queries
- Uses MongoDB aggregation pipeline for efficient data retrieval
- Parallel queries where possible to reduce response time
- Respects member status filters (only active members)

---

## API Usage Examples

### Get Stats (as Credit Officer)
```bash
curl -X GET http://localhost:3000/api/dashboard/stats \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json"
```

### Get Growth (as Treasurer)
```bash
curl -X GET "http://localhost:3000/api/dashboard/growth?months=12" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json"
```

---

## Future Enhancements

1. **Custom Dashboards**
   - Allow staff to customize which widgets they see

2. **Export Functionality**
   - Export dashboard data to CSV/PDF

3. **Real-time Updates**
   - WebSocket integration for live data updates

4. **Advanced Filtering**
   - Filter by date range, member group, branch, etc.

5. **Performance Metrics**
   - Dashboard load time monitoring
   - Query optimization tracking

---

## Troubleshooting

**Issue:** Dashboard returns `role not recognized`
- **Solution:** Check that user has at least one valid role assigned

**Issue:** Missing data in dashboard
- **Solution:** Verify data exists in database and user role has access

**Issue:** Slow dashboard load
- **Solution:** Check database indexes on frequently queried fields
