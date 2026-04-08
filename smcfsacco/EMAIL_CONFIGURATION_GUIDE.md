# Email Configuration & Failure Troubleshooting Guide

## 📧 .ENV Configuration for Email

### 1. **Email Service Setup (Resend API)**

Add these to your `.env` file:

```env
# ─── Email System (Resend API) ─────────────────────────────────────
# Required: Get free API key from https://resend.com
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx

# Email sender address - MUST be verified in Resend Dashboard
# During testing use: onboarding@resend.dev (Resend sandbox)
# For production use verified domain: noreply@yourdomain.com
RESEND_FROM_EMAIL=SMCF SACCO <noreply@smcf.app>

# Fallback mode for development (shows token in response if email fails)
ALLOW_EMAIL_TOKEN_FALLBACK=false

# Admin email addresses for system notifications (comma-separated)
ADMIN_EMAILS=admin@sacco.com,treasurer@sacco.com

# Batch size for bulk email sending (25 at a time recommended)
ADMIN_EMAIL_BATCH_SIZE=25

# Max recipients per broadcast (default 5000)
ADMIN_EMAIL_MAX_RECIPIENTS=5000

# Email resend cooldown (seconds between resend attempts)
EMAIL_RESEND_COOLDOWN_SECONDS=60
```

---

## 🔧 Why Emails Are Failing

Looking at your email history, failures happen because of:

### **Issue 1: Invalid/Bad Email Addresses in Database** ⚠️
**Symptoms:** Some emails fail, others succeed

**Causes:**
- Members with empty email fields
- Malformed email addresses (typos, missing @, spaces)
- Suspended/inactive member emails included
- Duplicate email entries

**Fix:** Run database cleanup
```javascript
// In MongoDB, remove or fix bad emails
db.members.updateMany(
  { email: { $regex: "^$|^ +" } },  // Empty or spaces
  { $set: { email: null } }
);

// Remove emails with obvious issues
db.members.updateMany(
  { email: { $regex: "[^@]+$" } },  // No @ symbol
  { $set: { email: null } }
);
```

---

### **Issue 2: Resend Email Not Verified** ⚠️
**Symptoms:** All emails have ~50% failure rate, especially to certain domains

**Current Status:**
```env
RESEND_FROM_EMAIL=SMCF SACCO <onboarding@resend.dev>
```

This is **Resend's sandbox email** - only works for testing with verified emails.

**Fix Options:**

#### **Option A: Register a Real Domain (RECOMMENDED)**
1. Login to https://resend.com
2. Go to **Domains**
3. Add your domain: `smcf.app` or `smcfsacco.co.ke`
4. Verify DNS records (Resend will guide you)
5. Update `.env`:
   ```env
   RESEND_FROM_EMAIL=SMCF SACCO <noreply@smcf.app>
   ```

#### **Option B: Use Default Resend Sandbox (Development Only)**
Only for testing - extremely limited delivery:
```env
RESEND_FROM_EMAIL=onboarding@resend.dev
ALLOW_EMAIL_TOKEN_FALLBACK=true
```

---

### **Issue 3: Missing RESEND_API_KEY** ⚠️
**Symptoms:** All emails fail immediately with "API Configuration Error"

**Fix:**
1. Go to https://resend.com
2. Create free account
3. Get API key from dashboard
4. Add to `.env`:
   ```env
   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
   ```

---

### **Issue 4: Active Filters Excluding Recipients**
**Symptoms:** "Sent emails" dropdown shows lower numbers than expected

**Check your broadcast settings:**
- ✅ "Staff Only" - excludes all members
- ✅ "Active Members Only" - excludes inactive/suspended
- ✅ "Verified Users Only" - excludes unverified emails

**If using filters:**
```env
# Only send to active members with verified emails
# Filters configured in UI: staffOnly=false, activeMembersOnly=true, verifiedUsersOnly=true
```

---

## 🔧 How Email Sending Works

```
1. Admin clicks "Send Email" → /api/communications/email-broadcast
   ↓
2. Backend fetches all user/member emails
   ↓
3. Normalizes emails (trim, lowercase, validate format)
   ↓
4. Deduplicates to remove duplicates
   ↓
5. Applies filters (staff-only, active, verified, etc.)
   ↓
6. Calls sendBulkEmail() in batches (25 at a time)
   ↓
7. Each batch sent in parallel via Resend API
   ↓
8. Failures recorded in database (EmailBroadcast model)
   ↓
9. Response shows: "X sent, Y failed"
```

**Failure Points:**
- ❌ Invalid email format (caught by regex validation)
- ❌ Resend API key invalid/missing
- ❌ Sender email not verified in Resend
- ❌ Recipient email doesn't exist
- ❌ Recipient email bouncing repeatedly
- ❌ Network timeout

---

## ✅ Complete .ENV Template

```env
# ═══════════════════════════════════════════════════════════════════
# 📧 EMAIL CONFIGURATION (CRITICAL FOR BROADCASTS)
# ═══════════════════════════════════════════════════════════════════

# Required: Resend.com API key (get free at https://resend.com)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx

# Sender address - format: "Name <email@domain.com>"
# IMPORTANT: Domain must be verified in Resend Dashboard
# Development: onboarding@resend.dev (Resend sandbox - 50% delivery)
# Production: noreply@yourdomain.com (after DNS verification)
RESEND_FROM_EMAIL=SMCF SACCO <noreply@smcf.app>

# Enable during development to show email token in response if delivery fails
ALLOW_EMAIL_TOKEN_FALLBACK=false

# Admin system notifications (to be notified of system activities)
ADMIN_EMAILS=admin@sacco.com,treasurer@sacco.com

# Bulk email sending batch size (emails per API call)
ADMIN_EMAIL_BATCH_SIZE=25

# Max recipients per broadcast (prevents runaway sends)
ADMIN_EMAIL_MAX_RECIPIENTS=5000

# Cooldown between resend attempts (seconds)
EMAIL_RESEND_COOLDOWN_SECONDS=60
```

---

## 🧪 Testing Email Configuration

### **Step 1: Check Email Health**
```bash
# Get email configuration status
curl http://localhost:5000/api/auth/email-delivery-health \
  -H "Authorization: Bearer {token}" \
  -H "X-Admin: true"

# Response shows:
# {
#   "status": "ok" | "degraded" | "misconfigured",
#   "summary": "...",
#   "details": {
#     "resendApiKeyConfigured": true/false,
#     "resendFromEmail": "...",
#     "fromDomain": "...",
#     "usingResendSandboxSender": true/false,
#     "fallbackEnabled": true/false
#   }
# }
```

### **Step 2: Send Test Broadcast**
1. Login as admin
2. Go to **Admin Communications**
3. Choose **"Dry Run"** first (shows how many emails would be sent)
4. Click "Test Email" to send to 1 person
5. Check delivery results

### **Step 3: Verify in Resend Dashboard**
1. Go to https://resend.com
2. Check **Logs** tab
3. View bounces, failures, delivery status

---

## 🚀 Fixing Failing Emails

### **Solution 1: Validate Email Addresses**
```javascript
// Add this validation to Member creation/update
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Remove bad emails before broadcast
db.members.deleteMany({ email: { $regex: "^[^@]+$|^ +|^$" } });
```

### **Solution 2: Verify Sender Domain**
1. Login to Resend.com
2. Click **Domains**
3. Click "Add Domain"
4. Enter: `smcf.app` or your actual domain
5. Copy DNS records to your domain registrar
6. Click "Verify"
7. Update `.env` with new sender:
   ```env
   RESEND_FROM_EMAIL=SMCF SACCO <noreply@smcf.app>
   ```

### **Solution 3: Clean Database**
```javascript
// Combine member emails with unique valid ones
db.members.aggregate([
  { $match: { email: { $exists: true, $ne: null } } },
  { $group: { _id: { email: "$email" } } }
]).forEach(doc => {
  // Keep first valid email, mark duplicates
});
```

### **Solution 4: Enable Fallback (Temporary)**
For development/testing while setting up domain:
```env
ALLOW_EMAIL_TOKEN_FALLBACK=true
```
This shows verification codes in API response if email fails.

---

## 📊 Understanding Broadcast Results

When you send a broadcast, you see:
```
Dry Run Summary:
  From Users: 25 (staff accounts)
  From Members: 120 (members with emails)
  Deduplicated Total: 140 (after removing duplicates)
  Skipped by Cap: 0 (none exceeded max)

Delivery Summary:
  Sent: 126 ✅
  Failed: 14 ❌
```

**What's happening:**
- **Sent**: Email reached Resend API successfully
- **Failed**: Invalid format, bad address, API error, or timeout
- **Failures are recorded** in `delivery.sampleFailures` (first 20 shown)

---

## 🔍 Debug Failures

### **View Sample Failures from Last Broadcast**
```bash
curl http://localhost:5000/api/communications/history \
  -H "Authorization: Bearer {admin-token}"

# Look for "sampleFailures" in response:
{
  "delivery": {
    "sent": 126,
    "failed": 14,
    "sampleFailures": [
      { "email": "bad@email", "error": "Invalid email format" },
      { "email": "test@@example.com", "error": "Malformed address" },
      { "email": "notreal@domain.co", "error": "Service unavailable" }
    ]
  }
}
```

---

## ✅ Checklist Before Going Live

- [ ] `RESEND_API_KEY` is set and valid (from https://resend.com)
- [ ] Domain is verified in Resend (not using sandbox)
- [ ] `RESEND_FROM_EMAIL` matches verified domain
- [ ] Database cleaned of invalid email addresses
- [ ] `ALLOW_EMAIL_TOKEN_FALLBACK=false` for production
- [ ] `ADMIN_EMAILS` configured with real admin email(s)
- [ ] Tested dry-run with small recipient count
- [ ] Tested actual send to 1-2 recipients
- [ ] Verified delivery in Resend logs
- [ ] Monitored failure rate (should be <5% after cleanup)

---

## 🆘 Still Having Issues?

### **Check these in order:**

1. **Is RESEND_API_KEY set?**
   ```bash
   echo $RESEND_API_KEY  # Should not be empty
   ```

2. **Is it a valid key format?**
   - Starts with `re_`
   - Length matches other keys
   - No spaces or special chars

3. **Is sender domain verified?**
   - Login to Resend
   - Go to Domains
   - See checkmark ✅ next to your domain

4. **Are database emails valid?**
   ```javascript
   // Check for bad emails
   db.members.find({ 
     $or: [
       { email: { $regex: "^$|^ +" } },
       { email: { $not: { $regex: "@" } } }
     ]
   }).count()
   ```

5. **Are you using sandbox sender?**
   - If using `onboarding@resend.dev`, expect 50% failure rate
   - Register real domain in Resend

---

## 📝 Quick Reference

| Config | Purpose | Example |
|--------|---------|---------|
| `RESEND_API_KEY` | API authentication | `re_xxxx...` |
| `RESEND_FROM_EMAIL` | Sender address | `SMCF <noreply@smcf.app>` |
| `ALLOW_EMAIL_TOKEN_FALLBACK` | Dev mode fallback | `false` |
| `ADMIN_EMAILS` | System notifications | `admin@sacco.com` |
| `ADMIN_EMAIL_BATCH_SIZE` | Batch size | `25` |
| `ADMIN_EMAIL_MAX_RECIPIENTS` | Max per broadcast | `5000` |
