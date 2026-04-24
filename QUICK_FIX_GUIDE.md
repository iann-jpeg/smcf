# Quick Fix Guide for Admin Issues

## 🔴 Issue 1: Notification Badge Not Showing

### Root Cause
The badge **ONLY appears when there are unread notifications** (`unreadCount > 0`)

### Current Component Location
- **File**: `smcfsacco/smcf-sacco/src/components/NotificationBell.tsx`
- **Header Display**: `smcfsacco/smcf-sacco/src/components/DashboardLayout.tsx` line 36

### How It Works
```typescript
// Shows badge only if unreadCount > 0
{unreadCount > 0 && (
  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center">
    {unreadCount > 9 ? "9+" : unreadCount}
  </span>
)}
```

### Why No Badge Visible
✓ Your backend is NOT creating notifications when events happen  
✓ Or notifications exist but are all marked as read

### Testing the Badge
1. Check backend logs: Do notifications get created?
2. Manually create a notification in MongoDB:
```javascript
db.notifications.insertOne({
  userId: "admin-user-id",
  type: "info",
  title: "Test Notification",
  message: "This is a test notification",
  read: false,
  created_at: new Date()
})
```
3. Refresh admin page - badge should appear with "1" count

### To Fix - Ensure Backend Creates Notifications
Check that these events trigger notification creation:
- Loan applications
- Member added
- Payment received
- Member documents uploaded
- KYC verified

---

## 🟢 Issue 2: Edit Member ID & Email

### ✅ Feature IS Implemented & Working

### Step-by-Step Process

**Step 1: Navigate to Members**
```
Admin Dashboard → Sidebar → Members
```

**Step 2: Find Member**
- Scroll or search for member
- Click member name or row

**Step 3: Member Detail Page Opens**
- Shows: Name, Email, Phone, Savings, Shares, KYC Status

**Step 4: Click "Edit" Button**
- Button in top-right (only visible if you're admin)
- Opens edit dialog

**Step 5: Edit Dialog Shows ALL Fields**
```
┌─────────────────────────────────┐
│ Edit Member — MEM241001         │
├─────────────────────────────────┤
│ Member ID: [  MEM241001  ]      │  ← Edit this
│ Full Name: [  John Doe   ]      │
│ Email:     [  john@email ]      │  ← Edit this
│ Phone:     [  254712345  ]      │
│ Savings:   [   50000     ]      │
│ Shares:    [   20000     ]      │
│ Status:    [ ▼ Active   ]       │
├─────────────────────────────────┤
│  [Cancel]  [Save Changes]       │
└─────────────────────────────────┘
```

**Step 6: Save Changes**
- Click "Save Changes"
- Backend validates:
  - ✓ No duplicate Member IDs
  - ✓ No duplicate emails
  - ✓ You must be admin role

### ⚠️ Backend Restrictions

**File**: `smcfsacco/smcf-sacco-backend/src/routes/members.ts` line 224

```typescript
// ONLY ADMIN can change Member ID or Email
const isAdmin = req.user?.roles?.includes('admin');
if (!isAdmin && (updatingMemberId || updatingEmail)) {
  return res.status(403).json({
    success: false,
    message: 'Only admin can edit member ID or member email'
  });
}
```

### If Edit Dialog Won't Load
**Problem**: "Edit" button doesn't appear

**Solution**: Check your user role
```javascript
// In browser console
localStorage.getItem('auth_user')
// Should show: roles: ["admin", ...]
```

### If Save Fails
**Error**: "Member ID already exists"
- Solution: Choose different Member ID

**Error**: "Email is already used"
- Solution: Choose different email

### Code Location Where Edit Happens
- **Frontend Dialog**: `smcfsacco/smcf-sacco/src/pages/MemberDetail.tsx` lines 406-443
- **Save Function**: Same file, `handleEdit` function
- **API Call**: `await updateMember.mutateAsync({...})`
- **Backend Route**: `PUT /api/members/:id`

---

## 🔵 Issue 3: How KYC Verification Works

### System Architecture

```
MEMBER SIDE (Upload Documents)
├── MyAccount Page → KYC Documents Tab
├── Upload: ID Copy
├── Upload: Passport Photo  
├── Upload: Membership Form
└── Upload: KRA PIN Certificate

                    ↓ (Documents stored in database)

ADMIN SIDE (Verify Documents)
├── Members Page
├── → Click on Member
├── → Member Detail Page
├── → View Documents (preview available)
├── → Click "Verify KYC" button
└── → Status changes to "KYC Verified"
```

### For Members - Upload Documents

**Location**: `smcfsacco/smcf-sacco/src/pages/MyAccount.tsx`

**Process**:
1. Go to **My Account**
2. Click **"KYC Documents"** tab
3. Upload each document:
   - National ID or Passport scan
   - Clear passport-size photo
   - Signed membership form
   - KRA PIN certificate

### For Admins - Verify KYC

**Location**: `smcfsacco/smcf-sacco/src/pages/MemberDetail.tsx`

**Step 1: Go to Members**
```
Admin Dashboard → Members
```

**Step 2: Click on Member**
- Shows member profile with all details

**Step 3: View KYC Status in Header**
```
[Member Name]  [Status Badge]  [KYC Pending/Verified]
               [❌ Risk High]    [Edit] [Link Account]
                                [Verify KYC] ← Click this
```

**Step 4: Documents Section**
Members will see documents in their profile tabs:
- Documents Tab shows all uploaded files
- Click to preview each document

**Step 5: Click "Verify KYC" Button**
- Button only appears if:
  - You are admin OR credit_officer
  - Member hasn't been verified yet
  
**Step 6: What Happens**
- Backend API called: `PUT /api/members/:id/verify-kyc`
- Sets: `kycVerified: true`
- Records: `kycVerifiedAt: now()`
- Records: `kycVerifiedBy: yourAdminId`

### KYC Fields in Database

```typescript
// Member Document
{
  _id: ObjectId,
  memberId: "MEM241001",
  name: "John Doe",
  
  // KYC Status
  kycVerified: true,           // ✅ Is verified?
  kycVerifiedAt: Date,         // When verified
  kycVerifiedBy: ObjectId,     // Which admin verified

  // Uploaded Documents (base64 data URLs)
  docIdCopy: "data:image/png;base64,...",
  docPassportPhoto: "data:image/png;base64,...",
  docMembershipForm: "data:image/pdf;base64,...",
  docKraPinCertificate: "data:image/png;base64,...",
}
```

### Viewing KYC Stats

**Compliance Page**: `smcfsacco/smcf-sacco/src/pages/Compliance.tsx`

Shows:
- Total KYC Verified: `X / Y members`
- Audit trail of who verified which members
- Timestamps of verifications

### Complete Documentation Flow

```
FLOW 1: MEMBER SUBMITS DOCUMENTS
  MyAccount → KYC Documents Tab
  → Upload ID, Passport, Form, KRA PIN
  → Saved to: member.docIdCopy, docPassportPhoto, etc.
  → Status: kyc_verified = false (pending)

FLOW 2: ADMIN REVIEWS
  Members → Click Member
  → MemberDetail page opens
  → View documents (preview in dialog)
  → Can see all 4 documents

FLOW 3: ADMIN VERIFIES
  → Click "Verify KYC" button
  → Calls: PUT /api/members/{id}/verify-kyc
  → Backend sets: kycVerified = true
  → Records timestamp: kycVerifiedAt
  → Records admin ID: kycVerifiedBy

FLOW 4: COMPLIANCE TRACKING
  Compliance Page shows:
  → Count of verified members
  → Who verified (admin name)
  → When verified (timestamp)
```

### File References

| Component | File | Content |
|-----------|------|---------|
| Member KYC Upload | `smcfsacco/smcf-sacco/src/pages/MyAccount.tsx` | Document upload form |
| Admin KYC View | `smcfsacco/smcf-sacco/src/pages/MemberDetail.tsx` | View docs + verify button |
| Backend Verify | `smcfsacco/smcf-sacco-backend/src/routes/members.ts` | PUT /:id/verify-kyc endpoint |
| Hook | `smcfsacco/smcf-sacco/src/hooks/useMembers.ts` | useVerifyMemberKyc() |
| Compliance Stats | `smcfsacco/smcf-sacco/src/pages/Compliance.tsx` | Show verified count |

### KYC Verification Endpoint

**Backend Route**: `PUT /api/members/:id/verify-kyc`

```typescript
router.put(
  '/:id/verify-kyc',
  protect,
  authorize('admin', 'credit_officer'),  // Only these roles can verify
  async (req, res) => {
    const member = await Member.findByIdAndUpdate(
      req.params.id,
      {
        kycVerified: true,
        kycVerifiedAt: new Date(),
        kycVerifiedBy: req.userId
      },
      { new: true }
    );
    res.json({ success: true, data: member });
  }
);
```

**Authorization**: Only `admin` or `credit_officer` role

---

## Summary Checklist

### ✅ Notification Badge
- [ ] Backend creates notifications on events
- [ ] Notifications stored in database
- [ ] `useNotifications()` hook fetches them
- [ ] Badge shows count when unreadCount > 0

### ✅ Member ID & Email Editing
- [ ] Member edit dialog loads (admin only)
- [ ] Both fields are editable in form
- [ ] Save validates no duplicates
- [ ] Changes persist to database

### ✅ KYC Verification
- [ ] Members upload documents
- [ ] Admin sees "Verify KYC" button
- [ ] Admin clicks to verify
- [ ] Status shows "KYC Verified"
- [ ] Compliance page shows counts

---

## Troubleshooting

### Notifications not showing
```bash
# Check MongoDB for notifications
db.notifications.find({})

# Check API endpoint
curl http://localhost:3000/api/notifications \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Member edit fails to save
```bash
# Check browser console for error message
# Common errors:
# "Only admin can edit member ID or email" → Not admin role
# "Member ID already exists" → Duplicate ID
# "Email is already used" → Duplicate email
```

### KYC button doesn't appear
```typescript
// Check in browser console:
console.log(hasRole("admin"))  // Should be true
console.log(member.kyc_verified) // Should be false
```
