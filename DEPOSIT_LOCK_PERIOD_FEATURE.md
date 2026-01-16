# Deposit Lock Period Feature

## Overview
Added a time-locked savings feature where members can choose a lock-in period when making wallet deposits. Locked funds cannot be withdrawn until the lock period expires, encouraging disciplined savings habits.

## Features Implemented

### 1. **Lock Period Selection**
- Members can choose from the following lock periods when depositing:
  - No lock (0 months) - withdraw anytime
  - 1 month
  - 3 months
  - 6 months
  - 12 months

### 2. **Locked Funds Tracking**
- System tracks locked deposits and their unlock dates
- Calculates total locked amount and earliest unlock date
- Shows locked vs available balance in withdrawal dialog

### 3. **Withdrawal Validation**
- Members can only withdraw unlocked funds
- System blocks withdrawal requests that exceed available (unlocked) balance
- Clear error messages show locked amount and unlock dates

### 4. **Visual Indicators**
- Lock period badge on deposit transactions (🔒 3mo, 🔒 6mo, etc.)
- Unlock date countdown displayed for locked deposits
- Color-coded balance breakdown in withdrawal dialog

## Database Changes

### Saving Model (`backend/models/Saving.js`)
Added new fields:
```javascript
lock_period_months: {
  type: Number,
  default: 0, // 0 means no lock, available immediately
},
unlock_date: {
  type: Date,
  default: null, // null means no lock, can withdraw anytime
}
```

### Payment Model (`backend/models/Payment.js`)
Added new field:
```javascript
lock_period_months: {
  type: Number,
  default: 0, // 0 means no lock
}
```

## Backend Changes

### 1. Routes Updated

#### `backend/routes/savings.js`
- **`POST /deposit`**: Accepts `lock_period_months` parameter and calculates `unlock_date`
- **`POST /withdraw`**: Validates that withdrawal amount doesn't exceed unlocked balance
  - Checks for deposits with `unlock_date > current date`
  - Calculates total locked amount
  - Returns detailed error with locked amount and earliest unlock date

#### `backend/routes/payments.js`
- **`POST /stk-push`**: Stores `lock_period_months` in payment record
- All payment processing functions updated to:
  - Read `lock_period_months` from payment record
  - Calculate `unlock_date` when creating Saving record
  - Add lock period info to transaction notes

#### `backend/routes/lipia.js`
- **Query status callback**: Applies lock period when creating Saving record
- **Lipia callback**: Applies lock period when processing completed payments

### 2. Lock Period Calculation
```javascript
// Calculate unlock date if lock period is specified
let unlockDate = null;
const lockPeriod = lock_period_months || 0;
if (lockPeriod > 0) {
  unlockDate = new Date();
  unlockDate.setMonth(unlockDate.getMonth() + lockPeriod);
}
```

### 3. Withdrawal Validation Logic
```javascript
// Check for locked deposits
const lockedDeposits = await Saving.find({
  member_id: memberId,
  transaction_type: "deposit",
  status: "completed",
  unlock_date: { $gt: new Date() }, // Still locked
}).sort({ unlock_date: 1 });

// Calculate total locked amount
let totalLockedAmount = 0;
for (const deposit of lockedDeposits) {
  totalLockedAmount += deposit.amount;
}

// Calculate available balance
const availableBalance = currentBalance - totalLockedAmount;

// Validate withdrawal against available balance
if (availableBalance < totalDeduction) {
  return error with locked amount and unlock date details
}
```

## Frontend Changes

### MemberWallet Component (`src/components/MemberWallet.tsx`)

#### New State Variables
```typescript
const [lockPeriodMonths, setLockPeriodMonths] = useState(0);
const [lockedFunds, setLockedFunds] = useState({
  amount: 0,
  earliestUnlockDate: null as Date | null,
});
```

#### Deposit Dialog Enhancement
Added lock period selector:
```tsx
<Select
  value={lockPeriodMonths.toString()}
  onValueChange={(value) => setLockPeriodMonths(parseInt(value))}>
  <SelectTrigger id="lockPeriod">
    <SelectValue placeholder="No lock - withdraw anytime" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="0">No lock - withdraw anytime</SelectItem>
    <SelectItem value="1">1 month</SelectItem>
    <SelectItem value="3">3 months</SelectItem>
    <SelectItem value="6">6 months</SelectItem>
    <SelectItem value="12">12 months</SelectItem>
  </SelectContent>
</Select>
```

#### Withdrawal Dialog Enhancement
Shows balance breakdown:
- Total Balance
- Locked Funds (with earliest unlock date)
- Available to Withdraw
- Info message about locked deposits

#### Transaction History Enhancement
- Lock period badge for locked deposits (🔒 3mo)
- Unlock date countdown for active locks
- Visual indicators using Clock icon

## User Flow

### Making a Locked Deposit
1. Member clicks "Deposit Money"
2. Enters amount and phone number
3. **NEW**: Selects lock period from dropdown (optional)
4. Sees confirmation: "Locked for X months" if lock period selected
5. Completes M-Pesa payment
6. Deposit is saved with `lock_period_months` and `unlock_date`

### Viewing Locked Deposits
1. Member opens wallet
2. Sees transactions with lock badges (🔒 3mo, 🔒 6mo)
3. For active locks, sees countdown: "Unlocks: Feb 16, 2026"
4. Summary shows total balance including locked funds

### Requesting Withdrawal
1. Member clicks "Request Withdrawal"
2. **NEW**: Sees balance breakdown:
   - Total Balance: KES 10,000
   - Locked Funds: KES 3,000 (unlocks: Feb 16, 2026)
   - Available to Withdraw: KES 7,000
3. Can only enter amount up to available balance
4. If attempting to withdraw locked funds, sees error:
   - "Insufficient unlocked balance"
   - Details about locked amount and unlock date
5. Successful requests only include unlocked funds

## Error Handling

### Backend Errors
```javascript
{
  success: false,
  error: "Insufficient unlocked balance. Withdrawal: KES 5000, Fee: KES 50, Total needed: KES 5050, Available balance: KES 2000 | Locked funds: KES 3000 (earliest unlock: 2/16/2026)",
  lockedAmount: 3000,
  availableBalance: 2000,
  earliestUnlockDate: "2026-02-16T..."
}
```

### Frontend Validation
- Input max attribute limits withdrawal amount to available balance
- Visual indicators prevent user confusion
- Clear messaging about locked vs available funds

## Benefits

1. **Encourages Disciplined Saving**: Members commit to saving for specific periods
2. **Prevents Impulsive Withdrawals**: Lock period acts as a barrier to premature withdrawals
3. **Flexible Options**: Members can choose no lock or various lock periods based on their goals
4. **Transparent System**: Clear visual indicators and balance breakdowns
5. **Admin-Friendly**: Automatic enforcement requires no manual intervention

## Testing Checklist

- [ ] Deposit with no lock period (0 months) - should be withdrawable immediately
- [ ] Deposit with 1 month lock - should show unlock date 1 month from now
- [ ] Deposit with 3, 6, 12 month locks - verify correct unlock dates
- [ ] Multiple deposits with different lock periods
- [ ] Attempt withdrawal of locked funds - should be blocked
- [ ] Attempt withdrawal after lock expires - should succeed
- [ ] Verify lock badges appear in transaction history
- [ ] Verify unlock dates display correctly
- [ ] Verify balance breakdown in withdrawal dialog
- [ ] Test with partial locked/unlocked balances
- [ ] Admin approval of withdrawal requests with mixed locked/unlocked funds

## Future Enhancements

1. **Early Unlock Penalty**: Allow early withdrawal with a penalty fee
2. **Interest Rate Bonus**: Offer higher interest rates for longer lock periods
3. **Lock Period Reminders**: Notify members when their deposits are about to unlock
4. **Recurring Locked Deposits**: Auto-deposit with lock periods on schedule
5. **Goal-Based Saving**: Link lock periods to specific savings goals
6. **Partial Unlock**: Allow graduated unlocking for long-term deposits

## Migration Notes

- Existing deposits automatically have `lock_period_months: 0` and `unlock_date: null`
- This means all existing deposits remain fully withdrawable
- No data migration required
- Feature is backward compatible

## API Reference

### Deposit with Lock Period
```javascript
POST /api/lipia/stk-push
{
  "amount": 5000,
  "phone": "254712345678",
  "type": "wallet_deposit",
  "lock_period_months": 3  // Optional, defaults to 0
}
```

### Withdrawal Request (Automatic Lock Validation)
```javascript
POST /api/savings/withdraw
{
  "amount": 2000,
  "notes": "Emergency withdrawal"
}
// Response includes locked amount info if validation fails
```

---

**Implementation Date**: January 16, 2026
**Status**: ✅ Complete and Ready for Testing
