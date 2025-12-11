# QR Code Payment Logic Fix

## Problem
The QR code payment system for cycle contributions was incorrectly crediting payments to the member making the payment instead of the member whose QR code was scanned.

## Solution
Updated the payment flow to properly separate:
- **Payer**: The logged-in member who receives the STK Push on their phone
- **Recipient**: The member whose QR code was scanned and who receives the payment credit

## Changes Made

### Backend (`backend/routes/payments.js`)

**Key Changes:**
1. Added validation for `organizationMemberId` parameter
2. Fetch both payer and recipient members separately:
   - `payer`: The logged-in member (from auth token)
   - `recipient`: The member whose QR code was scanned (from `organizationMemberId`)
3. Updated payment record creation:
   ```javascript
   {
     member_id: organizationMemberId,  // Credit goes to recipient
     phone: payer.phone,                // STK Push sent to payer
     paid_by: payerId,                  // Track who actually paid
     // ... other fields
   }
   ```
4. Update recipient's contribution tracking (not payer's)
5. Check if recipient (not payer) has already paid for the cycle
6. Emit socket event with both payer and recipient information
7. Return response with both payer and recipient details

### Frontend (`src/components/CycleQRPayment.tsx`)

**UI/UX Improvements:**
1. Updated dialog title: "Pay for Another Member's Cycle"
2. Clarified description: "You will receive the STK Push on YOUR phone"
3. Changed "Organization Verified" to "Member Verified"
4. Updated labels: "Paying for: [Member Name]"
5. Added info message: "STK Push will be sent to YOUR phone to complete this payment"
6. Updated success message to include recipient's name
7. Updated scan confirmation message

## Payment Flow

### Before Fix
1. Member A scans Member B's QR code
2. STK Push sent to Member A's phone ✅
3. Payment credited to Member A's account ❌ **WRONG**

### After Fix
1. Member A scans Member B's QR code
2. STK Push sent to Member A's phone ✅
3. Payment credited to Member B's cycle contribution ✅ **CORRECT**
4. System tracks: Member B received payment, paid by Member A ✅

## Testing Checklist

- [ ] Member can scan another member's QR code
- [ ] STK Push is sent to the logged-in member's phone
- [ ] Payment is credited to the scanned member's cycle contribution
- [ ] Duplicate payment check works for the recipient (not the payer)
- [ ] Success message shows recipient's name
- [ ] Socket.IO event includes both payer and recipient info
- [ ] Payment record shows both `member_id` (recipient) and `paid_by` (payer)
- [ ] Wallet payment logic remains unchanged

## Database Schema Note

The `Payment` model now uses:
- `member_id`: The member receiving the credit (recipient)
- `paid_by`: The member who actually made the payment (payer)
- `phone`: The phone that received the STK Push (payer's phone)

This allows tracking both who paid and who received credit, which is essential for transparency and auditing in table banking systems.

## Impact

✅ **Wallet payments**: No changes - wallet logic remains separate
✅ **Cycle payments via QR**: Now correctly credits the scanned member
✅ **Audit trail**: System tracks both payer and recipient
✅ **User experience**: Clear messaging about who is paying for whom
