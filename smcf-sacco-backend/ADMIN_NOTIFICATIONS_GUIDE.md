# Admin Email Notification System - Implementation Guide

## Overview

The admin email notification system automatically notifies administrators about important system activities via email. This ensures admins are informed in real-time about critical events without needing to constantly check the dashboard.

## Features

✅ **Automated Activity Notifications**
- Loan applications, approvals, and disbursements
- Payment receipts and defaults
- Member registrations and KYC completions
- Large transactions and system errors

✅ **Beautiful Email Templates**
- Color-coded by severity (Low, Medium, High, Critical)
- Activity-specific icons and branding
- Detailed information tables
- Mobile-responsive design

✅ **Fire-and-Forget Pattern**
- Never blocks main request
- Errors are logged but don't affect user operations
- Reliable delivery with Resend API

## Configuration

### 1. Environment Variable Setup

Add to your `.env` file (or Render.com environment settings):

```bash
# Admin notification emails (comma-separated)
ADMIN_EMAILS=ianabungana5@gmail.com,admin2@example.com,admin3@example.com
```

### 2. Validate Configuration

Check the admin notification status via API:

```bash
GET /api/admin/notification-status
```

Response:
```json
{
  "configured": true,
  "adminEmails": ["ianabungana5@gmail.com"],
  "status": "active"
}
```

## Integration Examples

### Example 1: Loan Request Notification

```typescript
// In your loan routes (POST /api/loans)
import { notifyLoanRequest } from '../services/adminNotificationService';

// After creating loan...
const loan = new Loan({
  memberId,
  amount,
  purpose,
  // ... other fields
});

await loan.save();

// Notify admin immediately
await notifyLoanRequest(
  loan._id.toString(),
  memberId,
  memberName,
  amount,
  purpose
);
```

### Example 2: Payment Received Notification

```typescript
// In your payment routes (POST /api/payments)
import { notifyPaymentReceived } from '../services/adminNotificationService';

// After processing payment...
const payment = await Payment.create({
  memberId,
  amount,
  type: 'loan-repayment',
  // ... other fields
});

// Notify admin
await notifyPaymentReceived(
  memberName,
  amount,
  'Loan Repayment'
);
```

### Example 3: Default Alert Notification

```typescript
// In your cron job or background task that checks for defaults
import { notifyDefaultAlert } from '../services/adminNotificationService';

// Check for loans overdue by 30+ days
const overdueLoans = await Loan.find({
  status: 'active',
  nextDueDate: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
});

for (const loan of overdueLoans) {
  const daysOverdue = Math.floor(
    (Date.now() - loan.nextDueDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  await notifyDefaultAlert(
    loan.memberId.toString(),
    memberName,
    loan._id.toString(),
    daysOverdue
  );
}
```

### Example 4: Large Transaction Alert

```typescript
// In your transaction processing
import { notifyLargeTransaction } from '../services/adminNotificationService';

const LARGE_TRANSACTION_THRESHOLD = 100000; // KES

if (transactionAmount > LARGE_TRANSACTION_THRESHOLD) {
  await notifyLargeTransaction(
    'Share Purchase',
    transactionAmount,
    currentUserName
  );
}
```

### Example 5: Error Notification

```typescript
// In error handling middleware
import { notifySystemError } from '../services/adminNotificationService';

try {
  // ... some operation
} catch (error) {
  console.error('Critical error:', error);
  
  await notifySystemError(
    error.name || 'Unknown Error',
    error.message,
    'Loan disbursement process'
  );
  
  res.status(500).json({ error: 'An error occurred' });
}
```

## Available Notification Functions

### Low-Level Function

```typescript
import { notifyAdmin, ActivityNotification } from '../services/adminNotificationService';

const notification: ActivityNotification = {
  type: 'LOAN_REQUEST',
  title: 'New Loan Application',
  description: 'A new loan application has been submitted',
  severity: 'medium',
  details: {
    'Loan ID': '123abc',
    'Amount': 'KES 100,000',
    'Member': 'John Doe'
  },
  actor: {
    name: 'John Doe',
    role: 'member'
  }
};

await notifyAdmin(notification);
```

### High-Level Functions

```typescript
// Loan-related
await notifyLoanRequest(loanId, memberId, memberName, amount, purpose);
await notifyLoanApproved(loanId, memberName, amount, approvedBy);
await notifyLoanDisbursed(loanId, memberName, amount);

// Payment-related
await notifyPaymentReceived(memberName, amount, paymentType);
await notifyDefaultAlert(memberId, memberName, loanId, daysOverdue);

// Member-related
await notifyMemberRegistered(memberId, memberName, email);
await notifyMemberKYCCompleted(memberId, memberName);

// Transaction-related
await notifyLargeTransaction(transactionType, amount, actorName);

// System-related
await notifySystemError(errorType, errorMessage, context);
```

## Activity Types and Severity

| Type | Icon | Severity | Trigger |
|------|------|----------|---------|
| LOAN_REQUEST | 📋 | Medium | New loan application submitted |
| LOAN_APPROVED | ✅ | Low | Loan approved by committee |
| LOAN_DISBURSED | 💰 | Low | Loan funds transferred to member |
| PAYMENT_RECEIVED | ✓ | Low | Member payment processed |
| DEFAULT_ALERT | ⚠️ | High | Loan payment overdue |
| MEMBER_REGISTERED | 👤 | Low | New member joins system |
| MEMBER_KYC | 🔍 | Low | KYC verification completed |
| SHARE_PURCHASED | 📈 | Low | Member purchases shares |
| DIVIDEND_DECLARED | 💵 | Medium | Dividend declared to members |
| LARGE_TRANSACTION | 🚨 | High | Transaction exceeds threshold |
| SYSTEM_ERROR | ❌ | Critical | System error occurs |
| ACTIVITY_ALERT | 🔔 | Low | General activity alert |

## Email Template Features

### Severity Color Coding
- **Low (Blue)**: Informational updates
- **Medium (Orange)**: Requires attention
- **High (Red)**: Important action needed
- **Critical (Dark Red)**: Urgent attention required

### Email Components
1. **Header** - Activity type and title
2. **Severity Badge** - Priority indicator
3. **Description** - What happened
4. **Actor Info** - Who performed the action
5. **Details Table** - Structured information
6. **Timestamp** - When it occurred
7. **Footer** - System info and support links

## Testing

### Test Email Delivery

```bash
curl -X POST http://localhost:5000/api/admin/test-notification \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "type": "LOAN_REQUEST",
    "title": "Test Loan Application",
    "description": "This is a test notification",
    "severity": "medium",
    "details": {
      "Loan ID": "TEST-123",
      "Amount": "KES 50,000",
      "Member": "Test Member"
    }
  }'
```

### Check Configuration

```bash
curl http://localhost:5000/api/admin/notification-status
```

## Best Practices

### ✅ DO
- Use fire-and-forget pattern (don't await in request handlers)
- Include relevant transaction IDs in details
- Use appropriate severity levels
- Test with actual admin emails before deploying
- Monitor admin email delivery in logs

### ❌ DON'T
- Await notification functions in critical paths
- Send duplicate notifications for the same event
- Include sensitive data (passwords, tokens) in emails
- Spam admins with low-severity notifications

## Production Setup

### 1. Render.com Environment Variables

Go to your service's **Settings → Environment**:

```
ADMIN_EMAILS=ianabungana5@gmail.com,admin@organization.com
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@smcf.app
```

### 2. Verify Email Sender

- Log in to Resend dashboard
- Verify your domain
- Update `RESEND_FROM_EMAIL` to use your verified sender

### 3. Monitor Delivery

Check service logs for email delivery:

```bash
# View recent logs
render logs --service smcf-sacco-backend --tail
```

Look for success messages:
```
[notifyAdmin] Notification sent successfully to admin@example.com
```

## Troubleshooting

### Emails Not Being Sent

**Problem**: `"No admin emails configured"`
- **Solution**: Set `ADMIN_EMAILS` environment variable

**Problem**: `Resend API error`
- **Solution**: Verify `RESEND_API_KEY` is correct in environment

**Problem**: Emails going to spam
- **Solution**: 
  - Verify domain in Resend
  - Update `RESEND_FROM_EMAIL` to verified sender
  - Add SPF/DKIM records

### Multiple Recipients

To notify multiple admins:

```env
ADMIN_EMAILS=admin1@example.com,admin2@example.com,admin3@example.com
```

## Performance Considerations

- Notifications are sent asynchronously (fire-and-forget)
- No impact on request response time
- Batch sending is handled by Resend API
- Logs are tracked for audit and debugging

## Future Enhancements

🔄 Planned improvements:
- [ ] Notification frequency throttling
- [ ] Email digests (hourly/daily summaries)
- [ ] Admin preference preferences (which activities to receive)
- [ ] SMS notifications for critical events
- [ ] Webhook support for external integrations
- [ ] Notification history dashboard

---

**Questions or issues?** Contact support@smcf.app
