# SMCF SACCO Codebase Exploration Summary

## Executive Summary
The codebase has a well-structured backend with email infrastructure (Resend API), in-app notifications, and audit logging systems in place. Both backends exist but the SACCO backend (smcf-sacco-backend) is more feature-complete with modern TypeScript architecture.

---

## 1. EMAIL SERVICE IMPLEMENTATION

### Location: `smcfsacco/smcf-sacco-backend/src/services/emailService.ts`

**Current Setup:**
- **Email Provider**: Resend API v6.9.4
- **Configuration**:
  - `RESEND_API_KEY`: API key for authentication
  - `RESEND_FROM_EMAIL`: Sender address (default: `SMCF SACCO <noreply@smcf.app>`)
  - `ALLOW_EMAIL_TOKEN_FALLBACK`: Fallback mode for development
  - `FRONTEND_URL`: URL for verification links

**Key Functions:**
```typescript
- sendVerificationEmail(email, fullName, token)
- sendBulkEmail(recipients[], subject, message)
- getEmailDeliveryHealth() // Health check with detailed status
- generateVerificationToken() // Creates 6-digit tokens
```

**Implementation Features:**
- Health check function that validates Resend configuration
- Sandbox sender detection (onboarding@resend.dev)
- Fallback code mode for unverified domains
- Token generation (6-digit codes + hashed tokens)
- HTML email templates with branded styling
- Batch email sending with configurable batch sizes (default 25)
- Email normalization and deduplication

**Limitations/Gaps:**
- Limited to verification emails currently
- No admin notification templates
- No retry logic for failed emails
- No email queue/scheduling system

---

## 2. NOTIFICATION SYSTEM

### Two Parallel Systems:

#### A. IN-APP NOTIFICATIONS
**Location**: `smcfsacco/smcf-sacco-backend/src/utils/notify.ts`

**Model**: `Notification` (MongoDB)
```typescript
interface INotification {
  userId: ObjectId
  title: string
  message: string
  type: 'info' | 'approval' | 'rejection'
  link: string | null
  read: boolean
  createdAt: Date
}
```

**Helper Functions:**
1. `notifyUser(userId, title, message, type, link)`
   - Notifies a specific user
   
2. `notifyMember(memberId, title, message, type, link)`
   - Looks up member's linked userId and notifies
   
3. `notifyStaff(title, message, type, link)` ⭐ **KEY FOR ADMIN NOTIFICATIONS**
   - Targets all users with roles: `admin`, `credit_officer`, `credit_committee`, `treasurer`
   - Creates notifications for entire staff
   - Fire-and-forget pattern (never throws)

**Routes**: `GET /api/notifications`, `POST /api/notifications`, `PUT /api/notifications/:id/read`

#### B. BROADCAST EMAIL SYSTEM
**Location**: `smcfsacco/smcf-sacco-backend/src/routes/communications.ts`

**Admin-Only Endpoint**: `POST /api/communications/email-broadcast`
- Requires: `admin` role
- Features:
  - Recipient filtering (staffOnly, activeMembersOnly, verifiedUsersOnly)
  - Manual email entry
  - Dry-run mode
  - HTML/plain text support
  - Branded template mode
  - Configurable recipient cap (default 5000)
  - Audit logging of all broadcasts

**Model**: `EmailBroadcast`
```typescript
interface IEmailBroadcast {
  createdBy: ObjectId
  subject: string
  messagePreview: string
  isHtml: boolean
  templateMode: 'plain' | 'branded'
  filters: IRecipientFilters
  recipients: IRecipientStats
  delivery: IDeliveryStats
  createdAt: Date
}
```

---

## 3. ACTIVITY LOGGING & EVENT TRACKING

### A. Audit Logging (SACCO Backend - Modern)
**Location**: `smcfsacco/smcf-sacco-backend/src/models/AdminAuditLog.ts`

**Purpose**: Track admin actions in detail
```typescript
interface IAdminAuditLog {
  adminId: ObjectId
  adminEmail: string
  action: AuditAction // 20+ predefined action types
  module: 'shareholders' | 'shares' | 'dividends' | 'reserves' | 'documents' | 'settings' | 'reports'
  relatedRecordType?: string
  relatedRecordId?: ObjectId
  description: string
  changes?: { field, beforeValue, afterValue }[]
  ipAddress?: string
  userAgent?: string
  device?: string
  status: 'success' | 'failure'
  isSensitive: boolean
  createdAt: Date
}
```

**Usage**: Applied via middleware
```typescript
@auditLog('communications', 'email_broadcast')
```

### B. General Audit Log (SACCO Backend)
**Location**: `smcfsacco/smcf-sacco-backend/src/models/AuditLog.ts`

Simple structure:
```typescript
interface IAuditLog {
  userId: ObjectId
  tableName: string
  recordId: string
  action: string
  changes: any
  ipAddress: string
  createdAt: Date
}
```

### C. Activity Tracking (Original Backend)
**Location**: `smcf/backend/middleware/activityTracker.js`

Features:
- UserSession model (tracks login/logout)
- LoginAttempt model (security tracking)
- ActivityLog model (general activity)
- Device/browser detection
- IP address tracking
- Session duration calculation

---

## 4. BACKEND STRUCTURE COMPARISON

### SACCO Backend (smcfsacco/smcf-sacco-backend) - **RECOMMENDED**
**Language**: TypeScript (modern)
**Framework**: Express.js
**Database**: MongoDB Atlas

**Structure**:
```
src/
├── config/          # Database connection
├── middleware/      # Auth, error handling, audit logging
├── models/          # 22 TypeScript models
├── routes/          # 14 API routes
├── services/        # Business logic (emailService, etc.)
├── scripts/         # Setup/seed scripts
├── types/           # Type definitions
└── utils/           # Helpers (notify.ts, etc.)
```

**Routes Available** (14 total):
- auth, members, loans, transactions
- notifications, dashboard, auditLogs
- simulation, repayments, savingsHistory
- users, mpesa, config, shares
- communications (email broadcast) ✅

### Original Backend (smcf/backend) - **LEGACY**
**Language**: JavaScript
**Framework**: Express.js

**Routes Available** (17 total):
- admin (legacy setup endpoint)
- analytics, announcements, auth
- creditScore, cycles, dashboard
- disbursements, guarantors, lipia
- loans, memberMessages, members
- payments, reserve, saccoPayments
- savings, search

---

## 5. USER & AUTHORIZATION SYSTEM

### User Model (SACCO Backend)
```typescript
interface IUser {
  email: string (unique, verified tracking)
  password: string (hashed)
  fullName: string | null
  avatarUrl: string | null
  roles: ('admin' | 'credit_officer' | 'credit_committee' | 'treasurer' | 'auditor' | 'member')[]
  isEmailVerified: boolean
  emailVerificationToken?: string
  emailVerificationExpires?: Date
  createdAt: Date
  updatedAt: Date
}
```

### Authorization System
**Middleware**: `middleware/auth.ts`

```typescript
- protect()           // JWT verification
- authorize(...roles) // Role-based access control

// Usage:
router.post('/api/communications/email-broadcast',
  protect,                    // Must be logged in
  authorize('admin'),         // Must have admin role
  auditLog(...),              // Log the action
  handler
);
```

**Staff Roles** (eligible for notifications):
- `admin`, `credit_officer`, `credit_committee`, `treasurer`, `auditor`

---

## 6. CURRENT EMAIL TEMPLATES

### Verification Email
**Location**: `emailService.ts` sendVerificationEmail()
- **Template Type**: HTML (branded)
- **Content**: Welcome + verification code + link
- **Expiry**: 24 hours
- **Design**: Blue-themed (#1a3a52) with button CTA

**No Admin Notification Templates** exist yet - **opportunity for implementation**

---

## 7. WHERE TO IMPLEMENT ADMIN NOTIFICATIONS

### Recommended Architecture

#### Option A: Dual Notification (In-App + Email)
**Pattern Already Exists**:
```typescript
// In-app notification
await notifyStaff('title', 'message', 'approval', '/link');

// Email notification (new)
await sendAdminNotificationEmail(adminIds, 'subject', 'htmlContent');
```

#### Option B: Event-Driven System
Current system is **request-response based** (no event emitter found).
Would require adding:
```typescript
// Not yet implemented
eventEmitter.on('shareholder.created', async (data) => {
  await notifyStaff(...);
  await sendAdminNotificationEmail(...);
});
```

#### Option C: Notification Service
Centralized service combining all notification methods.

### Best Locations to Inject Admin Notifications:

1. **Communications Route** (Already has email broadcast)
   - Add admin notification function
   - Extend with templating system

2. **Loan Routes** (smcfsacco/smcf-sacco-backend/src/routes/loans.ts)
   - Loan creation, approval, rejection
   - Disbursement events

3. **Member Routes** (smcfsacco/smcf-sacco-backend/src/routes/members.ts)
   - New member registration
   - KYC verification
   - Status changes

4. **Transaction Routes** (smcfsacco/smcf-sacco-backend/src/routes/transactions.ts)
   - Large transactions
   - Failed payments
   - Payment confirmations

5. **Repayment Routes** (smcfsacco/smcf-sacco-backend/src/routes/repayments.ts)
   - Defaulted loans
   - Payment schedules

---

## 8. EXISTING EMAIL TEMPLATES STRUCTURE

### EmailBroadcast Model
Already tracks broadcasts with:
- Template mode (`plain`, `branded`)
- Delivery stats (sent, failed, sample failures)
- Recipient filters
- Audit trail (createdBy, timestamps)

### Communication Service
Includes:
- HTML email support
- Template mode selection
- Bulk sending capabilities
- Dry-run testing

---

## 9. RECOMMENDED APPROACH FOR ADMIN NOTIFICATIONS

### Short-term Implementation
1. **Create AdminNotification Model**
   ```typescript
   interface IAdminNotification {
     adminIds: ObjectId[]
     eventType: string  // 'loan.created', 'member.registered', etc.
     title: string
     htmlContent: string
     actions: { label: string, url: string }[]
     priority: 'low' | 'medium' | 'high'
     createdAt: Date
     readBy: { adminId: ObjectId, readAt: Date }[]
   }
   ```

2. **Create Email Template Service**
   ```typescript
   // services/adminEmailTemplates.ts
   - loanCreatedTemplate(loan, member)
   - memberRegisteredTemplate(member)
   - largeTransactionTemplate(transaction)
   - paymentDefaultTemplate(loan)
   ```

3. **Extend notifyStaff() with Email**
   ```typescript
   export async function notifyStaffWithEmail(
     eventType: string,
     title: string,
     htmlTemplate: string,
     relatedId?: string
   ) {
     // 1. Create in-app notification
     await notifyStaff(title, plainTextSummary, type);
     
     // 2. Send admin email
     await sendAdminNotificationEmail(
       adminIds,
       title,
       htmlTemplate
     );
   }
   ```

4. **Add Route Handler**
   ```typescript
   // routes/adminNotifications.ts
   GET  /api/admin/notifications     // Get admin notifications
   PUT  /api/admin/notifications/:id/read
   DELETE /api/admin/notifications/:id
   ```

### Long-term Enhancement
- Notification preferences per admin (which events, email vs in-app)
- Email digest/summary (hourly, daily)
- Webhook support for external systems
- Notification templates management UI
- Email retry logic with exponential backoff

---

## 10. KEY FILES REFERENCE

| Purpose | File | Type |
|---------|------|------|
| Email Service | `emailService.ts` | Service |
| Email Broadcast | `routes/communications.ts` | Route |
| In-App Notifications | `utils/notify.ts` | Helper |
| Notification Model | `models/Notification.ts` | Model |
| Broadcast Model | `models/EmailBroadcast.ts` | Model |
| Admin Audit Logging | `models/AdminAuditLog.ts` | Model |
| Activity Tracking | `middleware/auditLog.ts` | Middleware |
| Authorization | `middleware/auth.ts` | Middleware |
| User Model | `models/User.ts` | Model |
| Server Setup | `server.ts` | Main |

---

## 11. ENVIRONMENT VARIABLES FOR EMAIL

**SACCO Backend** (`.env.example`):
```
RESEND_API_KEY=your-api-key
RESEND_FROM_EMAIL=SMCF SACCO <noreply@smcf.app>
ALLOW_EMAIL_TOKEN_FALLBACK=false
ADMIN_EMAIL_BATCH_SIZE=25
ADMIN_EMAIL_MAX_RECIPIENTS=5000
FRONTEND_URL=http://localhost:5173
```

---

## 12. SUMMARY TABLE

| Aspect | Status | Details |
|--------|--------|---------|
| **Email Service** | ✅ Implemented | Resend API with verification emails |
| **Email Templates** | ⚠️ Partial | Only verification email exists |
| **In-App Notifications** | ✅ Implemented | Staff notification function exists |
| **Email Broadcast to Admins** | ❌ Missing | Need dedicated admin notification system |
| **Activity Logging** | ✅ Implemented | AdminAuditLog + AuditLog models |
| **Event Tracking** | ⚠️ Partial | Request-response based, no event emitter |
| **Admin Authorization** | ✅ Implemented | Role-based middleware |
| **Audit Trail** | ✅ Implemented | Action tracking with IP, device, user agent |
| **Email Retry Logic** | ❌ Missing | No queue/retry system |
| **Notification Preferences** | ❌ Missing | No per-admin settings |

---

## Next Steps for Admin Notification Implementation

1. **Create `AdminNotification` Model** - Extend in-app notification system
2. **Design Email Templates** - Create branded admin notification templates
3. **Extend Email Service** - Add admin notification function
4. **Hook Into Routes** - Add notification calls to key routes
5. **Create Admin Routes** - GET/PUT endpoints for notification management
6. **Add Email Preferences** - Let admins control notification channels
7. **Testing** - Setup integration tests for notification flow
8. **Documentation** - Document the admin notification system

