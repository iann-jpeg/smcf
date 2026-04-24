## 🚀 Admin Email Notifications - Quick Start

### ⚡ 30-Second Setup

1. **Set admin email** in your `.env` file:
   ```bash
   ADMIN_EMAILS=ianabungana5@gmail.com
   ```

2. **Import notification service** in your route:
   ```typescript
   import { notifyLoanRequest } from '../services/adminNotificationService';
   ```

3. **Call notification** after creating something important:
   ```typescript
   // After loan is created
   await notifyLoanRequest(loanId, memberId, memberName, amount, purpose);
   ```

4. **Done!** Admin will receive an email within seconds.

---

### 📧 What Gets Sent

When you call a notification function, the admin receives:
- ✅ Beautiful HTML email with activity details
- ✅ Color-coded by severity (Low/Medium/High/Critical)
- ✅ Transaction IDs and relevant information
- ✅ Timestamp and actor information
- ✅ Mobile-responsive design

---

### 🎯 Key Functions

**Loans:**
```typescript
notifyLoanRequest(loanId, memberId, memberName, amount, purpose)
notifyLoanApproved(loanId, memberName, amount, approvedBy)
notifyLoanDisbursed(loanId, memberName, amount)
notifyDefaultAlert(memberId, memberName, loanId, daysOverdue)
```

**Payments:**
```typescript
notifyPaymentReceived(memberName, amount, paymentType)
```

**Members:**
```typescript
notifyMemberRegistered(memberId, memberName, email)
notifyMemberKYCCompleted(memberId, memberName)
```

**System:**
```typescript
notifyLargeTransaction(transactionType, amount, actorName)
notifySystemError(errorType, errorMessage, context)
```

---

### 🔧 Configuration

Set one admin:
```bash
ADMIN_EMAILS=admin@example.com
```

Set multiple admins (all get notified):
```bash
ADMIN_EMAILS=admin1@gmail.com,admin2@gmail.com,admin3@gmail.com
```

---

### ✅ Verify It's Working

```bash
# Check status
curl http://localhost:5000/api/admin/notification-status

# Should return:
{
  "configured": true,
  "adminEmails": ["ianabungana5@gmail.com"],
  "status": "active"
}
```

---

### 📝 Implementation Steps

1. Copy `adminNotificationService.ts` to your backend
2. Add `ADMIN_EMAILS` to `.env`
3. Import functions in your routes
4. Add notification calls after key actions
5. Test with actual email
6. Check logs for "Email sent successfully"
7. Deploy to production

See **ADMIN_NOTIFICATIONS_GUIDE.md** for detailed information.

See **INTEGRATION_EXAMPLE.ts** for complete route examples.

---

### 🎯 Best Practice

Add notifications to:
- ✅ Loan creation, approval, disbursement
- ✅ Payment received
- ✅ Default detection
- ✅ Member registration
- ✅ Large transactions
- ✅ System errors

Avoid notifying on:
- ❌ Every small action
- ❌ Duplicate events
- ❌ Non-critical updates

---

**Need help?** Check the examples in INTEGRATION_EXAMPLE.ts
