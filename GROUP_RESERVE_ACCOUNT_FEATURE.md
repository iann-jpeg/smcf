# Group Reserve Account Feature

## Overview

The Group Reserve Account is a system-level financial safety net designed to enhance the sustainability and risk management of the SMART MONEY CASH FLOW (SMCF) platform. This collective fund automatically accumulates from various sources and serves as a buffer against loan defaults, emergencies, and group financial challenges.

## Key Features

### 1. Automatic Fund Accumulation

The reserve account automatically receives contributions from multiple sources:

- **Early Withdrawal Penalties**: When members withdraw locked deposits before maturity
- **Loan Interest (97%)**: Majority of loan interest goes to reserve, 3% to operations
- **Loan Default Penalties**: Remaining balances from defaulted loans
- **Withdrawal Fees**: Transaction fees from savings withdrawals
- **System Fees**: Various operational fees
- **Cycle Contributions**: Monthly member credits (KES 20 per member)

### 2. Admin-Only Management

- Only administrators can withdraw from the reserve
- All withdrawals require justification (reason + notes)
- Monthly withdrawal limits enforced
- Approval workflow for transparency

### 3. Health Monitoring

The system calculates a Reserve Health Score (0-100) based on:

- **Balance Level (40%)**: Current reserve vs target
- **Loan Coverage Ratio (30%)**: Reserve vs outstanding loans
- **Growth Rate (20%)**: Month-over-month increase
- **Default Absorption (10%)**: Capacity to handle defaults

### 4. Governance Controls

- **Lock/Unlock Mechanism**: Freeze all reserve transactions with reason
- **Source Configuration**: Enable/disable individual funding sources
- **Withdrawal Limits**: Daily and monthly caps
- **Audit Trail**: Immutable transaction log

### 5. Transparency

- Members can view balance and health score (read-only)
- Recent transactions visible to all members
- Monthly reports generated automatically
- Clear explanation of reserve purpose

## Technical Implementation

### Backend Architecture

#### Models

**GroupReserveAccount** (`backend/models/GroupReserveAccount.js`)
```javascript
{
  current_balance: Number,           // Total available balance
  total_early_withdrawal: Number,    // Cumulative from early withdrawals
  total_loan_default: Number,        // Cumulative from defaults
  total_loan_interest: Number,       // Cumulative from loan interest
  total_withdrawal_fee: Number,      // Cumulative from withdrawal fees
  total_system_fee: Number,          // Cumulative from system fees
  total_cycle_contribution: Number,  // Cumulative from cycle payments
  monthly_withdrawal_total: Number,  // Current month withdrawals
  last_monthly_reset: Date,          // Last reset timestamp
  
  config: {
    enable_early_withdrawal_penalty: Boolean,
    enable_loan_default_penalty: Boolean,
    enable_loan_interest: Boolean,
    enable_withdrawal_fee: Boolean,
    enable_system_fee: Boolean,
    enable_cycle_contribution: Boolean,
    loan_interest_percentage: Number,     // Default: 97%
    monthly_withdrawal_limit: Number,     // Default: KES 100,000
    daily_withdrawal_limit: Number,       // Default: KES 20,000
    is_locked: Boolean,
    lock_reason: String,
    authorized_signatories: [String]
  }
}
```

**ReserveTransaction** (`backend/models/ReserveTransaction.js`)
```javascript
{
  type: "credit" | "debit",
  amount: Number,
  source: String,  // early_withdrawal_penalty, loan_default_penalty, etc.
  description: String,
  reference_id: ObjectId,      // Related document (Saving, Loan, etc.)
  reference_model: String,     // Model name
  performed_by: ObjectId,      // Admin for withdrawals
  approved_by: ObjectId,       // Approval authority
  approval_reason: String,     // Required for withdrawals
  approval_notes: String,
  balance_before: Number,
  balance_after: Number,
  metadata: Map,               // Extensible key-value pairs
  created_at: Date             // Immutable timestamp
}
```

#### Services

**reserveAccountService.js** (`backend/services/reserveAccountService.js`)

Core functions:
- `getReserveAccount()`: Get or create singleton account
- `addToReserve(amount, source, description, options)`: Credit reserve
- `withdrawFromReserve(amount, reason, adminId, notes)`: Debit reserve
- `calculateReserveHealth()`: Compute health score (0-100)
- `generateMonthlyReport(year, month)`: Aggregate monthly statistics
- `updateReserveConfig(config)`: Update governance settings
- `toggleReserveLock(isLocked, reason, adminId)`: Lock/unlock account
- `getRecentTransactions(limit, type)`: Query transaction history
- `getTransactionsByDateRange(startDate, endDate)`: Filter by period
- `getSourceBreakdown()`: Group totals by source

Health Score Formula:
```javascript
score = (balanceScore * 0.4) + 
        (loanCoverageScore * 0.3) + 
        (growthScore * 0.2) + 
        (defaultAbsorptionScore * 0.1)
```

#### API Routes

**Public Endpoints** (`/api/reserve`)
- `GET /balance`: Get current balance and health metrics
- `GET /transactions/public`: Recent transactions (limited info)

**Admin Endpoints** (`/api/reserve/admin`)
- `GET /summary`: Complete reserve summary with all metrics
- `GET /transactions`: Full transaction history with filters
- `POST /withdraw`: Execute withdrawal with reason
- `GET /report/:year/:month`: Generate monthly report
- `PUT /config`: Update reserve configuration
- `POST /toggle-lock`: Lock or unlock reserve
- `GET /health`: Detailed health score breakdown
- `GET /stats`: Statistical overview and trends

### Frontend Components

#### Admin UI

**ReserveAccountTab.tsx** (`src/components/admin/ReserveAccountTab.tsx`)

Features:
- **Dashboard Cards**: Balance, Health Score, Loan Coverage Ratio
- **Three-Tab Interface**:
  - **Overview**: Source-wise breakdown with pie chart
  - **Transactions**: Paginated audit log with filters
  - **Sources**: Configuration management
  
- **Actions**:
  - Withdraw funds (with reason dropdown)
  - Configure sources (enable/disable + limits)
  - Lock/Unlock account
  - Download monthly report (JSON)

#### Member UI

**ReserveBalanceCard.tsx** (`src/components/ReserveBalanceCard.tsx`)

Features:
- Read-only balance display
- Health score with color-coded indicator
- Loan coverage ratio with progress bar
- Recent transactions (last 10)
- Educational content about reserve purpose
- Explanation of funding sources

### Integration Points

#### 1. Early Withdrawal Penalties

**File**: `backend/services/earlyWithdrawalService.js`

```javascript
// In processEarlyWithdrawal()
await addToReserve(
  penaltyAmount,
  'early_withdrawal_penalty',
  `Early withdrawal penalty from ${saving.member.name}`,
  {
    reference_id: saving._id,
    reference_model: 'Saving'
  }
);
```

#### 2. Withdrawal Fees

**File**: `backend/routes/savings.js`

```javascript
// In approval endpoint
const fee = await TransactionFee.create({ /* ... */ });
await addToReserve(
  fee.amount,
  'withdrawal_fee',
  `Withdrawal fee from ${saving.member.name}`,
  {
    reference_id: fee._id,
    reference_model: 'TransactionFee'
  }
);
```

#### 3. Loan Interest

**File**: `backend/routes/lipia.js`

```javascript
// In loan repayment callback
const interestPaid = payment.amount - principalPaid;
const reserveConfig = await getReserveAccount();
const interestPercentage = reserveConfig.config.loan_interest_percentage || 97;
const reservePortion = (interestPaid * interestPercentage) / 100;

await addToReserve(
  reservePortion,
  'loan_interest',
  `Loan interest from ${loan.member.name}`,
  {
    reference_id: loan._id,
    reference_model: 'Loan',
    interest_total: interestPaid,
    reserve_percentage: interestPercentage
  }
);
```

#### 4. Cycle Contributions

**File**: `backend/routes/lipia.js`

```javascript
// In cycle payment callback
const memberCredit = 20; // KES 20 per member
await addToReserve(
  memberCredit,
  'cycle_contribution',
  `Cycle ${cycle.cycle_number} contribution from ${member.name}`,
  {
    reference_id: cycle._id,
    reference_model: 'Cycle',
    member_id: member._id
  }
);
```

#### 5. Loan Defaults (TODO)

**File**: `backend/routes/loans.js` (to be implemented)

```javascript
// When marking loan as defaulted
if (loan.status === 'active' && newStatus === 'defaulted') {
  const remainingAmount = loan.loan_amount - loan.amount_paid;
  await addToReserve(
    remainingAmount,
    'loan_default_penalty',
    `Loan default from ${loan.member.name}`,
    {
      reference_id: loan._id,
      reference_model: 'Loan',
      original_amount: loan.loan_amount,
      amount_paid: loan.amount_paid
    }
  );
}
```

## Usage Guide

### For Administrators

#### Viewing Reserve Dashboard

1. Navigate to Admin Dashboard
2. Click "Reserve" tab
3. View real-time metrics:
   - Current balance
   - Health score (color-coded)
   - Loan coverage ratio
   - Source breakdown

#### Withdrawing Funds

1. Click "Withdraw Funds" button
2. Enter withdrawal amount
3. Select reason from dropdown:
   - Emergency Expense
   - Loan Default Coverage
   - Member Assistance
   - Operational Cost
   - Equipment Purchase
   - Group Event
   - Other
4. Add detailed notes explaining withdrawal
5. Confirm withdrawal
6. Transaction logged in audit trail

#### Configuring Sources

1. Navigate to "Sources" tab
2. Toggle individual sources on/off
3. Adjust loan interest percentage (default 97%)
4. Set withdrawal limits:
   - Daily limit (default KES 20,000)
   - Monthly limit (default KES 100,000)
5. Save configuration

#### Locking Reserve

1. Click "Lock Reserve" button
2. Enter reason for lock
3. Confirm lock
4. All transactions (credits and debits) frozen
5. Unlock when issue resolved

#### Generating Reports

1. Select month/year from report section
2. Click "Download Report"
3. JSON file contains:
   - Opening balance
   - Closing balance
   - Total credits by source
   - Total debits
   - Transaction count
   - Health score trend

### For Members

#### Viewing Reserve Balance

1. Navigate to Member Dashboard
2. Locate "Group Reserve Account" card
3. View:
   - Current balance
   - Health score
   - Loan coverage ratio
   - Recent transactions

#### Understanding Reserve

Members can see:
- **Balance**: Total funds available for group protection
- **Health Score**: 0-100 rating of reserve strength
  - 80-100: Excellent (Green)
  - 60-79: Good (Yellow)
  - 40-59: Fair (Orange)
  - 0-39: Poor (Red)
- **Loan Coverage**: Percentage of outstanding loans covered
- **Recent Activity**: Latest contributions to reserve

## Data Flow

### Credit Flow (Automatic)

```
1. Member Action (e.g., early withdrawal)
   ↓
2. System detects penalty/fee/interest
   ↓
3. Calculate amount for reserve
   ↓
4. Check if source enabled in config
   ↓
5. Call addToReserve() service
   ↓
6. Create ReserveTransaction record
   ↓
7. Update GroupReserveAccount balance
   ↓
8. Update source-specific total
   ↓
9. Return success
```

### Debit Flow (Admin-Initiated)

```
1. Admin submits withdrawal request
   ↓
2. Validate amount against limits
   ↓
3. Check if reserve is locked
   ↓
4. Verify sufficient balance
   ↓
5. Create ReserveTransaction (debit)
   ↓
6. Update GroupReserveAccount balance
   ↓
7. Update monthly withdrawal total
   ↓
8. Log admin action
   ↓
9. Return success
```

### Health Score Calculation

```
1. Fetch current reserve balance
   ↓
2. Calculate total outstanding loans
   ↓
3. Get previous month balance
   ↓
4. Count recent defaults
   ↓
5. Compute 4 component scores:
   - Balance vs 10% of total savings
   - Reserve vs total loans
   - Month-over-month growth
   - Capacity to absorb defaults
   ↓
6. Apply weighted formula:
   (balance * 0.4) + (coverage * 0.3) + 
   (growth * 0.2) + (absorption * 0.1)
   ↓
7. Return score (0-100)
```

## Governance Rules

### Withdrawal Authorization

1. **Daily Limit**: KES 20,000 (configurable)
2. **Monthly Limit**: KES 100,000 (configurable)
3. **Reason Required**: Must select from predefined list
4. **Notes Required**: Detailed explanation mandatory
5. **Admin Audit**: All withdrawals logged with admin ID

### Lock Mechanism

When locked:
- No credits accepted (all sources disabled)
- No debits allowed (withdrawals blocked)
- Lock reason displayed to all users
- Only admins can unlock

Use cases:
- Financial audit in progress
- Dispute resolution
- System maintenance
- Governance review

### Source Management

Each source can be independently:
- Enabled/disabled
- Tracked separately (source-specific totals)
- Reported individually
- Configured with custom rules (e.g., interest percentage)

### Audit Trail

Every transaction records:
- Timestamp (immutable)
- Amount
- Type (credit/debit)
- Source
- Description
- Reference to original document
- Admin ID (for withdrawals)
- Approval reason and notes
- Balance before/after
- Extensible metadata

## Security Considerations

### Authentication

- All admin endpoints protected with `protect` middleware
- Role verification with `adminOnly` middleware
- JWT token validation required

### Authorization

- Only admins can:
  - Withdraw funds
  - Modify configuration
  - Lock/unlock reserve
  - View full transaction details
- Members can:
  - View balance
  - View health score
  - View limited transaction history

### Data Integrity

- Immutable transaction timestamps
- Balance calculated from transaction log
- Atomic operations for balance updates
- Transaction isolation to prevent race conditions

### Validation

- Amount validation (must be positive)
- Balance sufficiency checks
- Limit enforcement (daily/monthly)
- Source enablement verification
- Lock status verification

## Testing Scenarios

### Test Case 1: Early Withdrawal Penalty

1. Member locks deposit with maturity date
2. Member requests early withdrawal before maturity
3. System calculates penalty (10% default)
4. Penalty credited to reserve
5. Verify:
   - Reserve balance increased
   - ReserveTransaction created
   - Source = 'early_withdrawal_penalty'
   - total_early_withdrawal updated

### Test Case 2: Loan Interest Distribution

1. Member makes loan repayment
2. System splits payment (principal vs interest)
3. 97% of interest goes to reserve
4. 3% to operational account
5. Verify:
   - Reserve balance increased by 97% of interest
   - ReserveTransaction records interest breakdown
   - total_loan_interest updated
   - Metadata contains percentage and totals

### Test Case 3: Admin Withdrawal

1. Admin initiates withdrawal (KES 15,000)
2. Selects reason: "Emergency Expense"
3. Adds notes: "Member medical emergency"
4. Confirms withdrawal
5. Verify:
   - Reserve balance decreased
   - ReserveTransaction created (type: debit)
   - monthly_withdrawal_total updated
   - Withdrawal within daily/monthly limits
   - Admin ID recorded

### Test Case 4: Reserve Lock

1. Admin locks reserve with reason
2. Member triggers early withdrawal penalty
3. System attempts to credit reserve
4. Verify:
   - Transaction rejected (reserve locked)
   - Error message displayed
   - Balance unchanged
   - Lock reason visible to members

### Test Case 5: Health Score Calculation

1. Add KES 50,000 to reserve
2. Create loans totaling KES 200,000
3. Calculate health score
4. Verify:
   - Balance score component calculated
   - Loan coverage component calculated
   - Growth component calculated
   - Final score = weighted average
   - Score displayed correctly in UI

### Test Case 6: Monthly Report Generation

1. Admin requests report for specific month
2. System aggregates all transactions
3. Generates JSON report
4. Verify:
   - Opening balance correct
   - Closing balance correct
   - Credits grouped by source
   - Debits totaled
   - Transaction count accurate
   - Health score included

## Configuration Examples

### Default Configuration

```javascript
{
  enable_early_withdrawal_penalty: true,
  enable_loan_default_penalty: true,
  enable_loan_interest: true,
  enable_withdrawal_fee: true,
  enable_system_fee: true,
  enable_cycle_contribution: true,
  loan_interest_percentage: 97,
  monthly_withdrawal_limit: 100000,
  daily_withdrawal_limit: 20000,
  is_locked: false,
  lock_reason: null,
  authorized_signatories: []
}
```

### Conservative Configuration

```javascript
{
  enable_early_withdrawal_penalty: true,
  enable_loan_default_penalty: true,
  enable_loan_interest: true,
  enable_withdrawal_fee: true,
  enable_system_fee: true,
  enable_cycle_contribution: true,
  loan_interest_percentage: 100,  // All interest to reserve
  monthly_withdrawal_limit: 50000,  // Lower limit
  daily_withdrawal_limit: 10000,    // Lower limit
  is_locked: false,
  lock_reason: null,
  authorized_signatories: ['admin1@example.com', 'admin2@example.com']
}
```

### Emergency Mode Configuration

```javascript
{
  enable_early_withdrawal_penalty: false,  // Waive penalties
  enable_loan_default_penalty: true,
  enable_loan_interest: true,
  enable_withdrawal_fee: false,  // Waive withdrawal fees
  enable_system_fee: false,
  enable_cycle_contribution: false,
  loan_interest_percentage: 97,
  monthly_withdrawal_limit: 200000,  // Higher for emergency
  daily_withdrawal_limit: 50000,     // Higher for emergency
  is_locked: false,
  lock_reason: null,
  authorized_signatories: []
}
```

## API Reference

### Public Endpoints

#### GET /api/reserve/balance

Get current reserve balance and health metrics.

**Response:**
```json
{
  "current_balance": 150000,
  "health_score": 85.5,
  "loan_coverage_ratio": 0.45,
  "is_locked": false,
  "lock_reason": null
}
```

#### GET /api/reserve/transactions/public

Get recent transactions (limited information).

**Query Parameters:**
- `limit`: Number of transactions (default: 20, max: 50)

**Response:**
```json
{
  "transactions": [
    {
      "_id": "...",
      "type": "credit",
      "amount": 500,
      "source": "early_withdrawal_penalty",
      "description": "Early withdrawal penalty from John Doe",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### Admin Endpoints

#### GET /api/reserve/admin/summary

Get complete reserve summary with all metrics.

**Response:**
```json
{
  "account": {
    "current_balance": 150000,
    "total_early_withdrawal": 25000,
    "total_loan_default": 10000,
    "total_loan_interest": 80000,
    "total_withdrawal_fee": 15000,
    "total_system_fee": 5000,
    "total_cycle_contribution": 15000,
    "monthly_withdrawal_total": 20000,
    "last_monthly_reset": "2024-01-01T00:00:00Z",
    "config": { /* ... */ }
  },
  "health_score": 85.5,
  "loan_coverage_ratio": 0.45,
  "monthly_limit_remaining": 80000
}
```

#### GET /api/reserve/admin/transactions

Get full transaction history with filters.

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 50)
- `type`: Filter by type ("credit" or "debit")
- `source`: Filter by source
- `startDate`: Filter from date (ISO 8601)
- `endDate`: Filter to date (ISO 8601)

**Response:**
```json
{
  "transactions": [ /* ... */ ],
  "total": 150,
  "page": 1,
  "pages": 3
}
```

#### POST /api/reserve/admin/withdraw

Execute withdrawal from reserve.

**Request Body:**
```json
{
  "amount": 15000,
  "reason": "Emergency Expense",
  "notes": "Member medical emergency - hospital bill coverage"
}
```

**Response:**
```json
{
  "message": "Withdrawal successful",
  "transaction": {
    "_id": "...",
    "type": "debit",
    "amount": 15000,
    "source": "admin_withdrawal",
    "approval_reason": "Emergency Expense",
    "approval_notes": "Member medical emergency - hospital bill coverage",
    "balance_before": 150000,
    "balance_after": 135000,
    "created_at": "2024-01-15T14:30:00Z"
  },
  "new_balance": 135000
}
```

#### GET /api/reserve/admin/report/:year/:month

Generate monthly report for specified period.

**URL Parameters:**
- `year`: Year (e.g., 2024)
- `month`: Month (1-12)

**Response:**
```json
{
  "period": {
    "year": 2024,
    "month": 1,
    "month_name": "January"
  },
  "opening_balance": 100000,
  "closing_balance": 150000,
  "total_credits": 60000,
  "total_debits": 10000,
  "net_change": 50000,
  "credits_by_source": {
    "early_withdrawal_penalty": 5000,
    "loan_interest": 40000,
    "withdrawal_fee": 8000,
    "cycle_contribution": 7000
  },
  "transaction_count": 85,
  "health_score_start": 75.0,
  "health_score_end": 85.5
}
```

#### PUT /api/reserve/admin/config

Update reserve configuration.

**Request Body:**
```json
{
  "enable_early_withdrawal_penalty": true,
  "loan_interest_percentage": 95,
  "monthly_withdrawal_limit": 120000,
  "daily_withdrawal_limit": 25000
}
```

**Response:**
```json
{
  "message": "Reserve configuration updated successfully",
  "config": { /* updated config */ }
}
```

#### POST /api/reserve/admin/toggle-lock

Lock or unlock the reserve account.

**Request Body:**
```json
{
  "is_locked": true,
  "reason": "Monthly financial audit in progress"
}
```

**Response:**
```json
{
  "message": "Reserve account locked successfully",
  "is_locked": true,
  "lock_reason": "Monthly financial audit in progress"
}
```

#### GET /api/reserve/admin/health

Get detailed health score breakdown.

**Response:**
```json
{
  "overall_score": 85.5,
  "components": {
    "balance_score": 90.0,
    "loan_coverage_score": 85.0,
    "growth_score": 80.0,
    "default_absorption_score": 85.0
  },
  "metrics": {
    "current_balance": 150000,
    "total_savings": 1500000,
    "total_loans": 333333,
    "loan_coverage_ratio": 0.45,
    "monthly_growth": 50000,
    "monthly_growth_rate": 0.5
  },
  "recommendation": "Excellent"
}
```

#### GET /api/reserve/admin/stats

Get statistical overview and trends.

**Response:**
```json
{
  "current_balance": 150000,
  "health_score": 85.5,
  "loan_coverage_ratio": 0.45,
  "monthly_credits": 60000,
  "monthly_debits": 10000,
  "ytd_credits": 400000,
  "ytd_debits": 50000,
  "top_sources": [
    {
      "source": "loan_interest",
      "total": 200000,
      "percentage": 50.0
    },
    {
      "source": "early_withdrawal_penalty",
      "total": 100000,
      "percentage": 25.0
    }
  ]
}
```

## Future Enhancements

1. **Automated Monthly Reports**
   - Cron job to generate reports on 1st of each month
   - Email notifications to admins
   - Historical trend analysis

2. **Advanced Analytics**
   - Predictive modeling for reserve needs
   - Scenario analysis (what-if defaults increase)
   - Seasonal trend detection

3. **Multi-Signature Withdrawals**
   - Require multiple admin approvals for large withdrawals
   - Configurable threshold amounts
   - Approval workflow with notifications

4. **Investment Options**
   - Low-risk investment of idle reserve funds
   - Interest earnings back to reserve
   - Investment policy configuration

5. **Smart Alerts**
   - Low balance warnings
   - Unusual transaction patterns
   - Health score threshold alerts

6. **Integration with External Systems**
   - Mobile money API for withdrawals
   - Banking integration for transfers
   - Accounting software export

## Support and Maintenance

### Monitoring

- Check health score weekly
- Review transaction logs monthly
- Audit configuration quarterly
- Verify balance reconciliation

### Troubleshooting

**Issue**: Reserve balance not updating
- Check if source is enabled in config
- Verify reserve is not locked
- Review error logs for failed transactions

**Issue**: Health score showing "Poor"
- Review loan coverage ratio
- Check recent defaults
- Analyze growth trend
- Consider adjusting withdrawal limits

**Issue**: Cannot withdraw funds
- Verify monthly limit not exceeded
- Check daily limit not exceeded
- Ensure reserve is not locked
- Confirm sufficient balance

### Best Practices

1. **Regular Reviews**: Review reserve health monthly
2. **Conservative Withdrawals**: Only withdraw for approved purposes
3. **Document Everything**: Keep detailed notes for all withdrawals
4. **Monitor Trends**: Track health score over time
5. **Adjust Configuration**: Update limits based on group growth
6. **Communicate**: Keep members informed about reserve status
7. **Plan Ahead**: Set target reserve balance (e.g., 20% of total loans)

## Conclusion

The Group Reserve Account feature provides a robust, automated, and transparent system for managing group financial risks. By automatically accumulating funds from multiple sources and enforcing strict governance controls, it ensures the long-term sustainability of the SMCF platform while maintaining member trust through full transparency and audit trails.

For questions or support, contact the system administrator.
