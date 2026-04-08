# Password Reset System - Implementation Guide

## Overview

A complete password reset system has been implemented for SMCF SACCO that allows users to securely reset their passwords when forgotten. The system includes:

- **Backend API endpoints** for requesting and completing password resets
- **Email notifications** with secure reset links
- **Frontend UI pages** for the password reset flow
- **Security features** including token expiration and rate limiting

---

## Features

### 1. **Frontend Password Reset Pages**

#### **Forgot Password Page** (`/forgot-password`)
- Users enter their email address
- Backend sends a password reset email with a secure link
- Email includes a 6-digit code as fallback
- Rate limiting prevents spam (60-second cooldown between requests)
- Success confirmation page with resend option

#### **Reset Password Page** (`/reset-password?token=xyz`)
- Users receive this link via email
- Enter new password with confirmation
- Password validation (minimum 6 characters)
- Clear success/error messages
- Auto-redirect to login after successful reset

### 2. **Backend API Endpoints**

#### **POST /api/auth/forgot-password**
Initiates the password reset process.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "If an account exists with this email, a password reset link has been sent."
}
```

**Features:**
- Rate-limited (60 seconds between requests)
- Returns same response regardless of account existence (prevents email enumeration)
- Generates secure reset token with 24-hour expiration
- Sends email with reset link and fallback code
- Supports fallback token in response if email delivery fails

---

#### **POST /api/auth/reset-password**
Completes the password reset with the token from email.

**Request:**
```json
{
  "token": "123456",
  "newPassword": "newSecurePassword123"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Password reset successful. You can now log in with your new password.",
  "data": {
    "email": "user@example.com"
  }
}
```

**Response (Error - Invalid Token):**
```json
{
  "success": false,
  "message": "Password reset token is invalid or has expired. Please request a new reset link."
}
```

**Features:**
- Validates token format and expiration (24 hours)
- Hashes new password with bcrypt
- Clears reset token after successful reset
- Auto-logout not required (different auth token)

---

## Email Integration

### Password Reset Email

**From:** `SMCF SACCO <noreply@smcf.app>` (configured in `.env`)

**Subject:** "Reset Your Password - SMCF SACCO"

**Content Includes:**
- Personalized greeting with user's name
- Clear call-to-action button: "Reset Password"
- Direct reset link: `{FRONTEND_URL}/reset-password?token={resetToken}`
- 6-digit fallback code (if email service is unavailable)
- 24-hour expiration warning
- Security note about account compromise

**Delivery:**
- Uses Resend API (configured via `RESEND_API_KEY`)
- Automatic retry with rate limiting
- Fallback mode support (returns token in response if email fails)

---

## User Flow

### 1. **User Forgets Password**
```
User clicks "Forgot password?" on login page
         ↓
Navigates to /forgot-password
         ↓
Enters email address
         ↓
Click "Send Reset Link"
         ↓
Backend generates token + sends email (rate limited)
         ↓
Success page shown with confirmation message
```

### 2. **User Checks Email**
```
User receives email from noreply@smcf.app
         ↓
Clicks "Reset Password" button in email
         ↓
Redirected to /reset-password?token=123456 (link is auto-populated)
         ↓
Can also enter code manually if link doesn't work
```

### 3. **User Resets Password**
```
At /reset-password page
         ↓
Enters new password twice (confirmation)
         ↓
Click "Reset Password" button
         ↓
Backend validates token & updates password
         ↓
Success confirmation page
         ↓
Auto-redirect to /auth (login page) in 2 seconds
         ↓
User logs in with new password
```

---

## Database Schema

### User Model Updates

Added two new fields to store password reset state:

```typescript
passwordResetToken?: string;    // Hashed reset token (excluded from queries)
passwordResetExpires?: Date;    // 24-hour expiration
```

**Example document:**
```javascript
{
  _id: ObjectId("..."),
  email: "user@example.com",
  password: "$2a$10$...", // bcrypt hash
  fullName: "John Doe",
  roles: ["member"],
  isEmailVerified: true,
  
  // For active password reset requests:
  passwordResetToken: "$2a$10$...", // SHA256 hash of 6-digit code
  passwordResetExpires: ISODate("2026-03-27T12:00:00Z"), // 24 hours from request
  
  createdAt: ISODate("2026-01-01T..."),
  updatedAt: ISODate("2026-03-26T...")
}
```

---

## Security Considerations

### 1. **Token Security**
- 6-digit codes + SHA256 hashing (same as email verification)
- 24-hour expiration (configurable via backend)
- Tokens stored as hashes (never plain text)
- Tokens cleared immediately after successful reset

### 2. **Rate Limiting**
- 60-second cooldown between reset requests per email
- Prevents brute force and spam attacks
- Configurable via `EMAIL_RESEND_COOLDOWN_SECONDS` in `.env`

### 3. **Password Validation**
- Minimum 6 characters
- Hashed with bcrypt salt=10
- Confirmation required before submission

### 4. **Email Enumeration Prevention**
- Forgot password always returns "link sent" response
- Same response whether account exists or not
- Prevents attackers from discovering valid email addresses

### 5. **No Session Hijacking**
- Reset token separate from JWT auth token
- Old JWT continues working after reset
- Optional: Implement session invalidation if required

---

## Configuration

### Environment Variables

In `.env` (SACCO Backend):

```env
# Email Configuration (for reset emails)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx      # Required: Resend API key
RESEND_FROM_EMAIL=SMCF SACCO <noreply@smcf.app>  # Sender address
ALLOW_EMAIL_TOKEN_FALLBACK=false             # Fallback token in response if email fails

# Rate Limiting
EMAIL_RESEND_COOLDOWN_SECONDS=60             # Seconds between requests (default: 60)

# Frontend
FRONTEND_URL=https://smcf-sacco.vercel.app   # Used for reset link in emails
```

---

## Testing the Password Reset

### 1. **Local Development with Fallback**

Set `.env`:
```env
ALLOW_EMAIL_TOKEN_FALLBACK=true
```

When you request a password reset:
- Response includes the reset token (don't do this in production!)
- Web UI shows the token in the modal
- Use this token to manually test the reset

### 2. **Testing with Real Email**

Set `.env`:
```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx  # Your actual API key
RESEND_FROM_EMAIL=SMCF SACCO <noreply@smcf.app>
ALLOW_EMAIL_TOKEN_FALLBACK=false
```

Then:
1. Go to `/forgot-password`
2. Enter your test email
3. Check your inbox
4. Click the reset link
5. Enter new password

### 3. **API Testing with cURL**

**Request password reset:**
```bash
curl -X POST http://localhost:5000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com"}'
```

**If using fallback mode**, response includes:
```json
{
  "success": true,
  "data": {
    "resetToken": "123456"  // 6-digit code
  },
  "message": "Email delivery is unavailable..."
}
```

**Reset password:**
```bash
curl -X POST http://localhost:5000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "123456",
    "newPassword": "newPassword123"
  }'
```

---

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| **"Reset token is invalid or has expired"** | Token was invalid or >24h old | Request a new reset link |
| **"Email is required"** | Empty email field | Enter email and try again |
| **"Passwords do not match"** | Confirmation password differs | Re-enter matching passwords |
| **"Please wait Xs before requesting another reset"** | Rate limit exceeded | Wait 60 seconds and try again |
| **"Failed to send password reset email"** | Resend API not configured | Check `RESEND_API_KEY` in .env |
| **"Invalid reset token is missing"** | Direct  to `/reset-password` without token | Use link from email instead |

---

## Frontend Routes

```
/auth                    → Login/Signup
/forgot-password         → Request password reset email
/reset-password?token=X  → Reset password with token
```

All routes are public (no authentication required) to allow users to access them when locked out.

---

## API Response Status Codes

| Code | Scenario |
|------|----------|
| **200** | Success - password reset request sent or password updated |
| **400** | Bad request - validation error or invalid token |
| **429** | Rate limit exceeded - wait before next request |
| **503** | Email service unavailable and no fallback configured |

---

## Future Enhancements

Potential improvements for future versions:

1. **Session Invalidation**
   - Log out all other sessions after password reset
   - Force re-login on all devices

2. **Two-Factor Authentication**
   - Send 2FA code via SMS/email before reset
   - Verify code before allowing password change

3. **Password History**
   - Prevent reusing old passwords
   - Track password changes in audit logs

4. **Passwordless Login**
   - Magic link login as alternative to passwords
   - Optional: Passkeys/WebAuthn support

5. **Email Verification for Recovery**
   - Require email verification before sending reset link
   - Optional: Security questions

6. **Admin Password Reset**
   - Admins can reset user passwords from Members page
   - Temporary password emailed to user
   - User must change on first login

---

## Support & Troubleshooting

### If users aren't receiving emails:

1. **Check email configuration:**
   ```bash
   curl http://localhost:5000/api/auth/email-delivery-health \
     -H "Authorization: Bearer {admin-token}"
   ```

2. **Verify Resend API key:**
   - Go to https://resend.com
   - Copy API key from dashboard
   - Update `RESEND_API_KEY` in `.env`

3. **Verify sender domain:**
   - During setup, use `onboarding@resend.dev` (sandbox)
   - For production, register domain in Resend → Domains
   - Update `RESEND_FROM_EMAIL` in `.env`

4. **Enable fallback mode for testing:**
   ```env
   ALLOW_EMAIL_TOKEN_FALLBACK=true
   ```

---

## Code References

**Backend:**
- Model: `src/models/User.ts` - passwordResetToken, passwordResetExpires fields
- Routes: `src/routes/auth.ts` - `/forgot-password` and `/reset-password` endpoints
- Service: `src/services/emailService.ts` - `sendPasswordResetEmail()` function

**Frontend:**
- Pages: `src/pages/ForgotPassword.tsx` - Request reset email
- Pages: `src/pages/ResetPassword.tsx` - Complete password reset
- Page: `src/pages/Auth.tsx` - Login page with "Forgot password?" link
- Router: `src/App.tsx` - Route definitions
