# Early Withdrawal Penalty Feature

## Overview
The Early Withdrawal Penalty feature allows members to withdraw locked deposits before maturity, with configurable penalties that are redirected to the group reserve account. This provides flexibility while discouraging premature withdrawals through financial penalties and credit score impacts.

## Features

### 1. Admin Controls
- **Enable/Disable**: Admin can toggle early withdrawals on/off globally
- **Penalty Configuration**: Two penalty types available:
  - **Fixed**: Same penalty percentage regardless of remaining lock period
  - **Dynamic**: Penalty varies based on percentage of lock period remaining
- **Credit Score Penalty**: Configurable points deduction per early withdrawal
- **Reserve Account Tracking**: All penalties automatically added to group reserve

### 2. Dynamic Penalty Tiers (Default)
When dynamic penalties are enabled:
- **>75% time remaining**: 20% penalty
- **>50% time remaining**: 15% penalty  
- **>25% time remaining**: 10% penalty
- **<25% time remaining**: 5% penalty

**Example**: A member with a 12-month locked deposit who withdraws after 3 months (75% remaining) will incur a 20% penalty on the withdrawn amount.

### 3. Member Experience
- **Real-time Penalty Preview**: Members see calculated penalty before submitting request
- **Transparent Breakdown**: Shows:
  - Requested amount
  - Early withdrawal penalty
  - Withdrawal fee
  - Net amount they will receive
  - Credit score impact
- **Affected Deposits Details**: See which locked deposits are impacted and their unlock dates
- **Confirmation Required**: Members must acknowledge the penalty before proceeding

### 4. Admin Approval Process
When admin approves a withdrawal:
1. System checks for locked deposits
2. Calculates penalties based on remaining lock period (FIFO - oldest deposits first)
3. Deducts penalty and redirects to group reserve
4. Applies withdrawal fee to net amount (after penalty)
5. Reduces member's credit score by configured amount
6. Records early withdrawal flag and penalty details in transaction

## Technical Implementation

### Backend Components

#### 1. SystemSettings Model
**File**: `backend/models/SystemSettings.js`

Stores early withdrawal configuration:
```javascript
{
  early_withdrawal_enabled: Boolean,
  early_withdrawal_penalty_type: "fixed" | "dynamic",
  early_withdrawal_base_penalty: Number, // 0-50%
  early_withdrawal_dynamic_rates: {
    over_75_percent: 20,
    over_50_percent: 15,
    over_25_percent: 10,
    under_25_percent: 5
  },
  early_withdrawal_credit_penalty: Number, // Points deducted
  total_reserve_balance: Number
}
```

#### 2. Saving Model Updates
**File**: `backend/models/Saving.js`

New fields added:
```javascript
{
  is_early_withdrawal: Boolean,
  penalty_amount: Number,
  penalty_percentage: Number,
  penalty_reason: String
}
```

#### 3. Early Withdrawal Service
**File**: `backend/services/earlyWithdrawalService.js`

Key functions:
- `calculateEarlyWithdrawalPenalty(saving, amount)`: Calculates penalty based on lock period remaining
- `addToReserveAccount(penaltyAmount, adminId)`: Adds penalty to group reserve
- `getEarlyWithdrawalSettings()`: Retrieves current settings
- `updateEarlyWithdrawalSettings(updates, adminId)`: Admin updates configuration

#### 4. API Endpoints
**File**: `backend/routes/savings.js`

New routes:
- `POST /api/savings/check-early-withdrawal`: Preview penalty before submission
- `GET /api/savings/admin/early-withdrawal-settings`: Get current settings (admin)
- `PUT /api/savings/admin/early-withdrawal-settings`: Update settings (admin)

Updated routes:
- `POST /api/savings/admin/approve-withdrawal/:id`: Enhanced to handle early withdrawal penalties

### Frontend Components

#### 1. Member UI Enhancement
**File**: `src/components/MemberWallet.tsx`

Features:
- Real-time penalty checking on amount change (debounced)
- Penalty warning card with detailed breakdown
- Affected deposits display
- Credit score penalty notice
- Enhanced button text when penalty applies

State additions:
```typescript
const [earlyWithdrawalPenalty, setEarlyWithdrawalPenalty] = useState<any>(null);
const [showPenaltyWarning, setShowPenaltyWarning] = useState(false);
const [isCheckingPenalty, setIsCheckingPenalty] = useState(false);
```

#### 2. Admin Settings UI
**File**: `src/components/admin/EarlyWithdrawalSettings.tsx`

New dedicated settings page for:
- Enable/disable toggle
- Penalty type selector (fixed vs dynamic)
- Dynamic penalty rate configuration
- Credit score penalty setting
- Reserve balance display

**File**: `src/components/AdminDashboard.tsx`

Added "Settings" tab to admin dashboard with early withdrawal configuration.

## Usage Guide

### For Admins

#### 1. Enable Early Withdrawals
1. Navigate to Admin Dashboard
2. Click "Settings" tab
3. Toggle "Enable Early Withdrawals" switch
4. Configure penalty settings:
   - Choose penalty type (Fixed or Dynamic)
   - Set penalty percentages
   - Configure credit score penalty
5. Click "Save Settings"

#### 2. Configure Dynamic Penalties
- Set different penalty rates for each time remaining bracket
- Higher penalties discourage very early withdrawals
- Lower penalties for near-maturity withdrawals
- Recommended: Use declining penalty structure

#### 3. Monitor Reserve Account
- View current reserve balance in Settings page
- All early withdrawal penalties automatically added
- Use reserve funds for group activities or emergencies

#### 4. Process Early Withdrawal Requests
When approving withdrawals:
- System automatically detects locked deposits
- Calculates and applies penalties
- Displays net amount in approval interface
- Penalty and fee details recorded in transaction notes

### For Members

#### 1. Check Early Withdrawal Cost
1. Open "Request Withdrawal" dialog
2. Enter amount
3. System automatically shows penalty if applicable
4. Review breakdown:
   - Requested amount
   - Penalty amount and percentage
   - Withdrawal fee
   - Net amount you receive
   - Credit score impact

#### 2. Submit Early Withdrawal Request
1. Review penalty warning carefully
2. Confirm you understand the impact
3. Provide account details
4. Click "I Understand - Submit Request"
5. Wait for admin approval

#### 3. Understand Penalty Calculation
- Penalty based on time remaining until unlock
- More time remaining = higher penalty
- Multiple locked deposits handled in FIFO order
- Credit score reduced after approval

## Data Flow

### Early Withdrawal Request Flow
```
1. Member enters withdrawal amount
   ↓
2. Frontend debounces and calls check-early-withdrawal API
   ↓
3. Backend finds locked deposits (FIFO order)
   ↓
4. For each locked deposit:
   - Calculate % of lock period remaining
   - Determine penalty tier (if dynamic)
   - Calculate penalty amount
   ↓
5. Return total penalty + withdrawal fee + affected deposits
   ↓
6. Frontend displays warning with breakdown
   ↓
7. Member confirms and submits request
   ↓
8. Admin reviews and approves
   ↓
9. Backend applies penalty:
   - Deduct penalty → group reserve
   - Apply withdrawal fee
   - Reduce credit score
   - Mark as early withdrawal
   ↓
10. Member receives net amount
```

### Penalty Calculation Logic
```javascript
// Find all locked deposits
const lockedDeposits = await Saving.find({
  member_id: memberId,
  maturity_status: "locked",
  unlock_date: { $gt: new Date() }
}).sort({ created_at: 1 }); // FIFO

// Process each deposit
let remainingAmount = requestedAmount;
for (const deposit of lockedDeposits) {
  const amountFromDeposit = Math.min(remainingAmount, deposit.amount);
  
  // Calculate time remaining
  const totalDays = (unlockDate - depositDate) / (1000*60*60*24);
  const daysRemaining = (unlockDate - now) / (1000*60*60*24);
  const percentRemaining = (daysRemaining / totalDays) * 100;
  
  // Apply dynamic penalty tier
  let penalty = basePenalty;
  if (percentRemaining > 75) penalty = 20;
  else if (percentRemaining > 50) penalty = 15;
  else if (percentRemaining > 25) penalty = 10;
  else penalty = 5;
  
  const penaltyAmount = (amountFromDeposit * penalty) / 100;
  totalPenalty += penaltyAmount;
  
  remainingAmount -= amountFromDeposit;
}
```

## Database Schema

### SystemSettings Collection
```json
{
  "_id": ObjectId,
  "early_withdrawal_enabled": false,
  "early_withdrawal_penalty_type": "dynamic",
  "early_withdrawal_base_penalty": 10,
  "early_withdrawal_dynamic_rates": {
    "over_75_percent": 20,
    "over_50_percent": 15,
    "over_25_percent": 10,
    "under_25_percent": 5
  },
  "reserve_account_enabled": true,
  "total_reserve_balance": 0,
  "early_withdrawal_credit_penalty": 10,
  "updated_at": Date,
  "updated_by": ObjectId
}
```

### Saving Document (Enhanced)
```json
{
  "_id": ObjectId,
  "member_id": ObjectId,
  "amount": 5000,
  "transaction_type": "withdrawal",
  "status": "completed",
  "lock_period_months": 6,
  "unlock_date": Date,
  "maturity_status": "locked",
  // Early withdrawal fields
  "is_early_withdrawal": true,
  "penalty_amount": 500,
  "penalty_percentage": 15,
  "penalty_reason": "Early withdrawal penalty: 67% of lock period remaining (121 days until 2024-12-31)",
  "notes": "Member withdrawal | Withdrawal fee: KES 25 | Early withdrawal penalty: KES 500 (15%) - 67% remaining",
  "balance_before": 10000,
  "balance_after": 4475, // 10000 - 5000 - 25 (fee)
  "created_at": Date,
  "processed_at": Date,
  "processed_by": ObjectId
}
```

## Business Rules

1. **Early Withdrawal Availability**
   - Must be enabled by admin globally
   - Only applies to locked deposits (maturity_status = "locked")
   - Matured or unlocked deposits have no penalty

2. **Penalty Calculation**
   - Applied to requested amount, not balance
   - Penalty deducted from member's final payout
   - Withdrawal fee calculated on NET amount (after penalty)
   - Multiple deposits processed in FIFO order

3. **Credit Score Impact**
   - Penalty applied after admin approval
   - Reduces savings_credibility_score
   - Score cannot go below 0
   - Each early withdrawal counts separately

4. **Reserve Account**
   - All penalties automatically added
   - Tracked in SystemSettings.total_reserve_balance
   - Not part of any member's balance
   - Admin can view total in settings

5. **Transaction Recording**
   - is_early_withdrawal flag set to true
   - penalty_amount and penalty_percentage recorded
   - penalty_reason includes days remaining and unlock date
   - Full details in transaction notes

## Security Considerations

1. **Admin Only Configuration**: Only admins can enable/configure early withdrawals
2. **Member Awareness**: Members must see penalty before submitting (no surprises)
3. **Audit Trail**: All settings changes tracked with updated_by field
4. **Balance Integrity**: Total deduction = requested amount + fee (penalty already deducted from payout)
5. **Idempotency**: Penalty only applied once during approval

## Testing Scenarios

### Test Case 1: Basic Early Withdrawal
1. Admin enables early withdrawals (dynamic, default rates)
2. Member deposits KES 10,000 with 12-month lock
3. After 3 months (75% remaining), member requests KES 5,000 withdrawal
4. Expected penalty: 20% × 5,000 = KES 1,000
5. Expected fee: ~KES 25
6. Member receives: 5,000 - 1,000 - 25 = KES 3,975
7. Reserve account increases by KES 1,000
8. Credit score decreases by 10 points

### Test Case 2: Multiple Locked Deposits
1. Member has two locked deposits:
   - Deposit A: KES 5,000 (8 months remaining, 67%)
   - Deposit B: KES 3,000 (2 months remaining, 17%)
2. Member requests KES 7,000 withdrawal
3. System processes FIFO:
   - Deposit A: 5,000 × 15% = KES 750 penalty
   - Deposit B: 2,000 × 5% = KES 100 penalty
4. Total penalty: KES 850
5. Fee on (7,000 - 850): ~KES 31
6. Member receives: 7,000 - 850 - 31 = KES 6,119

### Test Case 3: Fixed Penalty Type
1. Admin sets penalty type to "fixed" at 10%
2. Member requests early withdrawal
3. Regardless of time remaining, penalty = 10% of amount

### Test Case 4: Early Withdrawal Disabled
1. Admin disables early withdrawals
2. Member requests withdrawal from locked deposit
3. System shows "Early withdrawal is currently disabled"
4. Member must wait for maturity

## Migration Notes

### Existing Data
- All existing Saving documents compatible (new fields default to false/0)
- SystemSettings auto-created on first access with safe defaults
- No migration script needed

### Backward Compatibility
- Feature disabled by default (early_withdrawal_enabled: false)
- Existing withdrawal flow unchanged if disabled
- All existing functionality preserved

## Future Enhancements

1. **Partial Penalty Waivers**: Admin override to reduce penalty for specific cases
2. **Penalty History Report**: Track all early withdrawals and penalties collected
3. **Member Penalty Limits**: Maximum number of early withdrawals per member per year
4. **Time-Based Grace Period**: No penalty if within X days of maturity
5. **Reserve Account Usage Tracking**: Report on how reserve funds are utilized
6. **Notification System**: Alert members when deposits are close to maturity

## Summary

The Early Withdrawal Penalty feature provides a balanced approach to locked savings:
- **Flexibility** for members who need emergency access to funds
- **Deterrent** through financial penalties and credit score impact
- **Group Benefit** via reserve account accumulation
- **Transparency** with upfront penalty calculations
- **Control** for admins to configure based on group needs

All penalties are calculated fairly based on remaining lock time, ensuring members who withdraw near maturity pay less than those who withdraw early. The credit score impact adds a non-financial deterrent while the reserve account benefits the entire group.
