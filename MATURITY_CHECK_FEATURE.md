# Maturity Check & Withdrawal Account Features

## Overview
Enhanced the deposit lock period system with automated maturity tracking, withdrawal account details, and comprehensive admin savings management.

## Features Implemented

### 1. **Automated Maturity Check System**

#### Daily Automated Check
- System runs every minute and executes maturity check at midnight (00:00)
- Also runs on server startup (5 seconds after initialization)
- Automatically updates deposit status from `locked` → `matured` when unlock_date is reached

#### Maturity Status Types
- **`none`**: No lock period (can withdraw anytime)
- **`locked`**: Before unlock_date (cannot withdraw)
- **`matured`**: After unlock_date (can withdraw)
- **`withdrawn`**: Already withdrawn

#### Maturity Service (`backend/services/maturityCheckService.js`)
```javascript
checkMaturedDeposits()  // Daily check for matured deposits
getMaturityStats()       // Get statistics (locked/matured/withdrawn counts)
markDepositAsWithdrawn() // Mark deposits as withdrawn after approval
```

### 2. **Withdrawal Account Details**

#### Member Side
Members now provide banking details when requesting withdrawals:
- **Account Name**: Full name as per bank account
- **Account Number**: Bank account number
- **Bank Name**: Name of the bank (e.g., Equity Bank, KCB)

#### Validation
- All three fields are required before submission
- Clear error messages if fields are missing
- Account details saved with withdrawal request

#### Storage
New fields in Saving model:
```javascript
preferred_account_name: String
preferred_account_number: String
preferred_bank: String
```

### 3. **Admin Savings Management Enhancements**

#### Pending Withdrawals View
Admins can now see:
- Member details (name, member ID, phone)
- Withdrawal amount
- Balance before/after
- **Account details column** showing:
  - Account name
  - Account number
  - Bank name
- Requested date
- Notes/reason for withdrawal
- Approval/rejection actions

#### New Admin API Endpoints

**Check Maturity (Manual Trigger)**
```
POST /api/savings/check-maturity
```
Manually trigger maturity check (runs automatically daily)

**Get Maturity Statistics**
```
GET /api/savings/maturity-stats
```
Returns:
- Count of locked deposits
- Count of matured deposits
- Count of withdrawn deposits
- Upcoming maturities (next 7 days)

**Get All Deposits with Maturity Info**
```
GET /api/savings/admin/all-with-maturity?maturity_status=locked&member_id=123
```
Query parameters:
- `maturity_status`: Filter by status (locked/matured/withdrawn/all)
- `member_id`: Filter by specific member

Response includes:
- All deposit fields
- `is_matured`: Boolean indicating if unlock date has passed
- `days_until_maturity`: Number of days remaining (negative if passed)

## Database Changes

### Saving Model Updates
```javascript
{
  // Existing lock period fields
  lock_period_months: Number,
  unlock_date: Date,
  
  // NEW: Maturity tracking
  maturity_status: {
    type: String,
    enum: ["locked", "matured", "withdrawn", "none"],
    default: "none"
  },
  maturity_reached_date: Date, // When deposit matured
  
  // NEW: Withdrawal account details
  preferred_account_name: String,
  preferred_account_number: String,
  preferred_bank: String,
}
```

### Automatic Status Updates
When creating deposits:
```javascript
maturity_status: lockPeriod > 0 ? "locked" : "none"
```

When maturity check runs:
```javascript
// If current_date >= unlock_date
maturity_status: "matured"
maturity_reached_date: new Date()
```

## Backend Implementation

### Daily Cron Job (server.js)
```javascript
// Check every minute, execute at midnight
setInterval(async () => {
  const now = new Date();
  if (now.getHours() === 0 && now.getMinutes() === 0) {
    await checkMaturedDeposits();
  }
}, 60000);

// Run on startup
setTimeout(async () => {
  await checkMaturedDeposits();
}, 5000);
```

### Maturity Check Logic
```javascript
async function checkMaturedDeposits() {
  // Find all locked deposits past their unlock date
  const maturedDeposits = await Saving.find({
    transaction_type: "deposit",
    status: "completed",
    maturity_status: "locked",
    unlock_date: { $lte: new Date() }
  });
  
  // Update each to matured status
  for (const deposit of maturedDeposits) {
    deposit.maturity_status = "matured";
    deposit.maturity_reached_date = new Date();
    await deposit.save();
  }
}
```

### Withdrawal Request with Account Details
```javascript
POST /api/savings/withdraw
{
  amount: 5000,
  notes: "Emergency withdrawal",
  account_name: "John Doe",
  account_number: "1234567890",
  bank_name: "Equity Bank"
}
```

## Frontend Implementation

### Member Withdrawal Dialog Enhancement
**New Form Fields:**
```tsx
<Label htmlFor="withdrawAccountName">Account Name *</Label>
<Input
  id="withdrawAccountName"
  value={withdrawAccountName}
  onChange={(e) => setWithdrawAccountName(e.target.value)}
  required
/>

<Label htmlFor="withdrawAccountNumber">Account Number *</Label>
<Input
  id="withdrawAccountNumber"
  value={withdrawAccountNumber}
  onChange={(e) => setWithdrawAccountNumber(e.target.value)}
  required
/>

<Label htmlFor="withdrawBankName">Bank Name *</Label>
<Input
  id="withdrawBankName"
  placeholder="e.g., Equity Bank, KCB, Co-operative Bank"
  value={withdrawBankName}
  onChange={(e) => setWithdrawBankName(e.target.value)}
  required
/>
```

**Validation:**
```typescript
if (!withdrawAccountName || !withdrawAccountNumber || !withdrawBankName) {
  toast({
    title: "Account Details Required",
    description: "Please provide your account details to receive the funds",
    variant: "destructive",
  });
  return;
}
```

### Admin Approvals Tab Enhancement
**Account Details Display:**
```tsx
<TableCell>
  {withdrawal.preferred_account_name || withdrawal.preferred_account_number || withdrawal.preferred_bank ? (
    <div className="text-sm">
      <div className="font-medium">{withdrawal.preferred_account_name || 'N/A'}</div>
      <div className="text-muted-foreground">
        {withdrawal.preferred_account_number || 'N/A'}
      </div>
      <div className="text-xs text-muted-foreground">
        {withdrawal.preferred_bank || 'N/A'}
      </div>
    </div>
  ) : (
    <span className="text-xs text-muted-foreground">No account provided</span>
  )}
</TableCell>
```

## User Flows

### 1. Member Requests Withdrawal
1. Member opens wallet
2. Clicks "Request Withdrawal"
3. Sees balance breakdown (total, locked, available)
4. Enters withdrawal amount
5. **NEW**: Provides account details:
   - Account name
   - Account number
   - Bank name
6. Optionally adds reason/notes
7. Submits request
8. Account details saved with request

### 2. Admin Reviews Withdrawal
1. Admin opens "Approvals" tab
2. Sees pending withdrawals with:
   - Member information
   - Withdrawal amount
   - **NEW**: Account details (name, number, bank)
   - Request date
   - Notes
3. Can approve or reject
4. On approval:
   - Admin knows exactly where to send funds
   - System deducts from member balance
   - Deposit status updated to "withdrawn"

### 3. Automated Maturity Processing
**Daily at Midnight:**
1. System scans all locked deposits
2. Finds deposits where `unlock_date <= current_date`
3. Updates each deposit:
   - `maturity_status`: "locked" → "matured"
   - `maturity_reached_date`: current timestamp
4. Logs matured deposits count

**Member Perspective:**
- Locked deposits show countdown: "Unlocks: Feb 16, 2026"
- After maturity:
  - Lock badge changes color/style
  - Funds become available for withdrawal
  - "Request Withdrawal" button enabled for matured funds

## Admin Features

### Maturity Dashboard (Future Enhancement)
The new endpoints enable creation of:
- Maturity calendar showing upcoming unlocks
- Statistics dashboard:
  - Total locked funds: KES X
  - Maturing this week: KES Y
  - Maturing this month: KES Z
- Member-specific maturity view
- Bulk maturity reports

### Manual Maturity Check
Admins can manually trigger maturity check:
```
POST /api/savings/check-maturity
```
Useful for testing or if automated check fails

## Benefits

### For Members
1. **Clear Payment Process**: Know exactly where withdrawal will be sent
2. **Account Control**: Update account details with each withdrawal
3. **Transparency**: See maturity status and unlock dates
4. **Security**: Account details only shared when making withdrawal request

### For Admins
1. **Efficient Processing**: All payment info in one place
2. **Reduced Errors**: No need to ask members for account details separately
3. **Audit Trail**: Account details saved with each withdrawal
4. **Automated Compliance**: Maturity status automatically tracked
5. **Better Reporting**: Filter by maturity status, track upcoming maturities

### For System
1. **Automated Status Management**: No manual updates needed
2. **Scalable**: Handles thousands of deposits daily
3. **Reliable**: Runs on server startup and daily at midnight
4. **Auditable**: Tracks maturity_reached_date for each deposit

## Testing Checklist

- [x] Maturity service created and integrated
- [x] Daily cron job scheduled
- [x] Server startup maturity check
- [ ] Test maturity check with past unlock dates
- [ ] Test maturity check with future unlock dates
- [ ] Verify status changes from locked→matured
- [ ] Test withdrawal with all account fields filled
- [ ] Test withdrawal with missing account fields (should fail)
- [ ] Verify admin sees account details in pending withdrawals
- [ ] Test manual maturity check endpoint
- [ ] Test maturity stats endpoint
- [ ] Test filtering by maturity_status
- [ ] Verify maturity_reached_date is set correctly
- [ ] Test with multiple deposits for same member
- [ ] Test withdrawal after maturity
- [ ] Verify account details persist after approval/rejection

## Configuration

### Environment Variables
No new environment variables required. Uses existing MongoDB and server configuration.

### Cron Schedule
**Default:** Runs at 00:00 (midnight) every day
**Startup:** Runs 5 seconds after server starts

To modify schedule, edit [server.js](d:\smart money cash flow\smcf\backend\server.js):
```javascript
// Change hour/minute check
if (now.getHours() === 0 && now.getMinutes() === 0) {
  // Runs at midnight
}
```

## API Reference

### Check Matured Deposits
```
POST /api/savings/check-maturity
Authorization: Admin token required

Response:
{
  success: true,
  count: 5,
  deposits: [...]
}
```

### Get Maturity Statistics
```
GET /api/savings/maturity-stats
Authorization: Admin token required

Response:
{
  success: true,
  stats: {
    locked: 45,
    matured: 12,
    withdrawn: 203,
    upcomingMaturities: 8
  },
  upcomingDeposits: [...]
}
```

### Get Deposits with Maturity Info
```
GET /api/savings/admin/all-with-maturity?maturity_status=locked
Authorization: Admin token required

Response:
{
  success: true,
  data: [
    {
      _id: "...",
      member_id: {...},
      amount: 5000,
      lock_period_months: 3,
      unlock_date: "2026-04-16T00:00:00Z",
      maturity_status: "locked",
      is_matured: false,
      days_until_maturity: 90,
      ...
    }
  ],
  count: 45
}
```

### Request Withdrawal with Account Details
```
POST /api/savings/withdraw
Authorization: Member token required

Body:
{
  amount: 5000,
  notes: "Emergency withdrawal",
  account_name: "John Doe",
  account_number: "1234567890",
  bank_name: "Equity Bank"
}

Response:
{
  success: true,
  message: "Withdrawal request submitted. Awaiting admin approval.",
  data: {...}
}
```

## Migration Notes

### Existing Data
- Existing deposits will have `maturity_status: "none"` by default
- Deposits with `lock_period_months > 0` created before this update will need manual status check
- Run maturity check after deployment to update any deposits that should be matured:
  ```
  POST /api/savings/check-maturity
  ```

### Backward Compatibility
- Old withdrawal requests without account details will show "No account provided"
- System continues to work with or without account details
- Account details are optional in database but required in UI

---

**Implementation Date**: January 16, 2026  
**Status**: ✅ Complete and Ready for Testing  
**Dependencies**: Existing lock period feature (DEPOSIT_LOCK_PERIOD_FEATURE.md)
