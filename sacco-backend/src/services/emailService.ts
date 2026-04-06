import { Resend } from 'resend';
import crypto from 'crypto';

const resend = new Resend(process.env.RESEND_API_KEY);
const DEFAULT_FROM = 'SMCF SACCO <noreply@smcf.app>';

function getFromAddress(): string {
  // Prefer configured sender, fallback to Resend's verified sandbox sender.
  return process.env.RESEND_FROM_EMAIL || DEFAULT_FROM;
}

function extractEmailAddress(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return (match?.[1] || from).trim().toLowerCase();
}

export function getEmailDeliveryHealth(): {
  status: 'ok' | 'degraded' | 'misconfigured';
  summary: string;
  details: {
    resendApiKeyConfigured: boolean;
    resendFromEmail: string;
    fromDomain: string | null;
    usingResendSandboxSender: boolean;
    fallbackEnabled: boolean;
    frontendUrl: string;
  };
  actions: string[];
} {
  const resendApiKeyConfigured = Boolean(process.env.RESEND_API_KEY);
  const resendFromEmail = getFromAddress();
  const fromAddress = extractEmailAddress(resendFromEmail);
  const fromDomain = fromAddress.includes('@') ? fromAddress.split('@')[1] : null;
  const usingResendSandboxSender = fromAddress.endsWith('@resend.dev');
  const fallbackEnabled = process.env.ALLOW_EMAIL_TOKEN_FALLBACK === 'true';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (!resendApiKeyConfigured) {
    return {
      status: fallbackEnabled ? 'degraded' : 'misconfigured',
      summary: 'Resend API key is not configured.',
      details: {
        resendApiKeyConfigured,
        resendFromEmail,
        fromDomain,
        usingResendSandboxSender,
        fallbackEnabled,
        frontendUrl,
      },
      actions: [
        'Set RESEND_API_KEY in backend environment variables.',
        fallbackEnabled
          ? 'Fallback code mode is enabled, so verification can still proceed without email delivery.'
          : 'Enable ALLOW_EMAIL_TOKEN_FALLBACK=true temporarily if users are blocked.',
      ],
    };
  }

  if (usingResendSandboxSender) {
    return {
      status: 'degraded',
      summary: 'Using Resend sandbox sender (onboarding@resend.dev). Delivery may be limited for unverified domains/accounts.',
      details: {
        resendApiKeyConfigured,
        resendFromEmail,
        fromDomain,
        usingResendSandboxSender,
        fallbackEnabled,
        frontendUrl,
      },
      actions: [
        'Verify your domain in Resend Domains.',
        'Set RESEND_FROM_EMAIL to a sender on the verified domain (e.g. noreply@yourdomain.com).',
        fallbackEnabled
          ? 'Disable ALLOW_EMAIL_TOKEN_FALLBACK after domain verification to enforce email-only verification.'
          : 'Enable ALLOW_EMAIL_TOKEN_FALLBACK=true temporarily if delivery issues continue.',
      ],
    };
  }

  return {
    status: 'ok',
    summary: 'Email delivery is configured with a non-sandbox sender.',
    details: {
      resendApiKeyConfigured,
      resendFromEmail,
      fromDomain,
      usingResendSandboxSender,
      fallbackEnabled,
      frontendUrl,
    },
    actions: [
      'Monitor resend-verification errors in logs.',
      fallbackEnabled
        ? 'Consider setting ALLOW_EMAIL_TOKEN_FALLBACK=false once delivery is consistently reliable.'
        : 'No action needed.',
    ],
  };
}

/**
 * Generate a verification token
 */
export const generateVerificationToken = (): { token: string; hash: string; expiresIn: Date } => {
  const token = crypto.randomInt(100000, 1000000).toString();
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresIn = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  
  return { token, hash, expiresIn };
};

/**
 * Send verification email using Resend
 */
export const sendVerificationEmail = async (
  email: string,
  fullName: string,
  verificationToken: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth?token=${verificationToken}`;

    const result = await resend.emails.send({
      from: getFromAddress(),
      to: email,
      subject: 'Verify Your Email Address - SMCF SACCO',
      text: `Welcome to SMCF SACCO, ${fullName}!\n\nUse this verification code: ${verificationToken}\n\nVerification link: ${verificationLink}\n\nThis code/link expires in 24 hours.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a3a52;">Welcome to SMCF SACCO, ${fullName}!</h2>
          <p style="color: #333; line-height: 1.6;">
            Thank you for registering with us. To complete your account setup and start using our services, 
            please verify your email address by clicking the button below.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" 
               style="background-color: #1a3a52; color: white; padding: 12px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block; 
                      font-weight: bold;">
              Verify Email Address
            </a>
          </div>
          
          <p style="color: #666; font-size: 12px;">
            Or copy and paste this link in your browser:
            <br/>
            <a href="${verificationLink}" style="color: #1a3a52; text-decoration: none; word-break: break-all;">
              ${verificationLink}
            </a>
          </p>

          <div style="margin: 16px 0; padding: 14px; border: 1px solid #cbd5e1; border-radius: 8px; background: #f8fafc; text-align: center;">
            <p style="margin: 0 0 6px; color: #334155; font-size: 12px; letter-spacing: 0.03em;">VERIFICATION CODE</p>
            <p style="margin: 0; color: #0f172a; font-size: 28px; font-weight: 700; letter-spacing: 0.2em; font-family: 'Courier New', monospace;">
              ${verificationToken}
            </p>
          </div>
          
          <p style="color: #999; font-size: 12px; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 20px;">
            This link will expire in 24 hours. If you didn't create this account, please ignore this email.
          </p>
          
          <p style="color: #999; font-size: 12px;">
            SMCF SACCO Management System
          </p>
        </div>
      `
    });

    if (result.error) {
      console.error('Resend email error:', result.error);
      return { success: false, error: result.error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Email sending failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to send email' };
  }
};

/**
 * Send password reset email using Resend
 */
export const sendPasswordResetEmail = async (
  email: string,
  fullName: string,
  resetToken: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;

    const result = await resend.emails.send({
      from: getFromAddress(),
      to: email,
      subject: 'Reset Your Password - SMCF SACCO',
      text: `Hi ${fullName},\n\nYou requested a password reset for your SMCF SACCO account.\n\nUse this reset code: ${resetToken}\n\nReset link: ${resetLink}\n\nThis link expires in 24 hours.\n\nIf you didn't request this, please ignore this email.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a3a52;">Password Reset Request</h2>
          <p style="color: #333; line-height: 1.6;">
            Hi ${fullName},
          </p>
          <p style="color: #333; line-height: 1.6;">
            We received a request to reset the password for your SMCF SACCO account. 
            Click the button below to set a new password.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" 
               style="background-color: #10b981; color: white; padding: 12px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block; 
                      font-weight: bold; font-size: 16px;">
              Reset Password
            </a>
          </div>
          
          <p style="color: #666; font-size: 12px;">
            Or copy and paste this link in your browser:
            <br/>
            <a href="${resetLink}" style="color: #1a3a52; text-decoration: none; word-break: break-all;">
              ${resetLink}
            </a>
          </p>

          <div style="margin: 16px 0; padding: 14px; border: 1px solid #cbd5e1; border-radius: 8px; background: #f8fafc; text-align: center;">
            <p style="margin: 0 0 6px; color: #334155; font-size: 12px; letter-spacing: 0.03em;">RESET CODE</p>
            <p style="margin: 0; color: #0f172a; font-size: 28px; font-weight: 700; letter-spacing: 0.2em; font-family: 'Courier New', monospace;">
              ${resetToken}
            </p>
          </div>
          
          <p style="color: #dc2626; font-size: 12px; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 20px;">
            <strong>Security Note:</strong> This link will expire in 24 hours. If you didn't request a password reset, 
            please ignore this email or contact support if your account may have been compromised.
          </p>
          
          <p style="color: #999; font-size: 12px;">
            SMCF SACCO Management System
          </p>
        </div>
      `
    });

    if (result.error) {
      console.error('Resend email error:', result.error);
      return { success: false, error: result.error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Email sending failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to send email' };
  }
};

/**
 * Verify the email token
 */
export const verifyEmailToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export interface BulkEmailSendInput {
  recipients: string[];
  subject: string;
  message: string;
  isHtml?: boolean;
  templateMode?: 'plain' | 'branded';
}

export interface BulkEmailSendResult {
  attempted: number;
  sent: number;
  failed: number;
  failures: Array<{ email: string; error: string }>;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function textToHtml(value: string): string {
  const safe = escapeHtml(value);
  return `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827; white-space: pre-wrap;">${safe}</div>`;
}

function brandedTemplate(subject: string, bodyHtml: string): string {
  return `
    <div style="margin:0; padding:24px; background:#f3f4f6; font-family: Arial, sans-serif; color:#111827;">
      <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden;">
        <div style="padding:18px 24px; background:linear-gradient(135deg, #1f7a3e 0%, #0f5132 100%); color:#ffffff;">
          <p style="margin:0; font-size:12px; letter-spacing:0.08em; text-transform:uppercase; opacity:0.9;">SMCF SACCO</p>
          <h2 style="margin:6px 0 0; font-size:20px; line-height:1.3;">${escapeHtml(subject)}</h2>
        </div>
        <div style="padding:24px;">${bodyHtml}</div>
        <div style="padding:14px 24px; background:#f9fafb; border-top:1px solid #e5e7eb; color:#6b7280; font-size:12px;">
          This message was sent by SMCF SACCO administration.
        </div>
      </div>
    </div>
  `;
}

/**
 * Validate email address with comprehensive checks
 */
function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  
  const trimmed = email.trim().toLowerCase();
  if (trimmed.length < 5 || trimmed.length > 254) return false;
  
  // RFC 5322 simplified email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) return false;
  
  // Additional checks
  if (trimmed.startsWith('.') || trimmed.startsWith('@') || trimmed.endsWith('@')) return false;
  if (trimmed.includes('..') || trimmed.includes(' ')) return false;
  if (trimmed.includes('<') || trimmed.includes('>')) return false;
  
  return true;
}

/**
 * Send a bulk email in small batches to avoid provider bursts and keep per-recipient failures visible.
 * Includes comprehensive validation and error handling.
 */
export const sendBulkEmail = async ({
  recipients,
  subject,
  message,
  isHtml = false,
  templateMode = 'plain',
}: BulkEmailSendInput): Promise<BulkEmailSendResult> => {
  // Step 1: Normalize and validate all emails
  const validEmails: string[] = [];
  const invalidEmails: Array<{ email: string; reason: string }> = [];
  
  recipients.forEach((email) => {
    const normalized = String(email || '').trim().toLowerCase();
    
    if (!normalized) {
      invalidEmails.push({ email: String(email), reason: 'Empty email' });
      return;
    }
    
    if (!isValidEmail(normalized)) {
      invalidEmails.push({ email: normalized, reason: 'Invalid email format' });
      return;
    }
    
    validEmails.push(normalized);
  });
  
  // Step 2: Deduplicate valid emails
  const uniqueRecipients = Array.from(new Set(validEmails));
  
  const attempted = recipients.length;
  if (uniqueRecipients.length === 0) {
    return { 
      attempted, 
      sent: 0, 
      failed: invalidEmails.length, 
      failures: invalidEmails.map(item => ({ 
        email: item.email, 
        error: item.reason 
      })) 
    };
  }

  const batchSize = Math.max(1, Number(process.env.ADMIN_EMAIL_BATCH_SIZE || 25));
  const result: BulkEmailSendResult = {
    attempted: uniqueRecipients.length,
    sent: 0,
    failed: 0,
    failures: [...invalidEmails.map(item => ({ 
      email: item.email, 
      error: item.reason 
    }))],
  };

  // Step 3: Send emails in batches with delay between batches
  for (let i = 0; i < uniqueRecipients.length; i += batchSize) {
    const batch = uniqueRecipients.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.map(async (email) => {
        try {
          // Validate before sending (double-check)
          if (!isValidEmail(email)) {
            return { ok: false, email, error: 'Invalid email format detected before send' };
          }
          
          const response = await resend.emails.send({
            from: getFromAddress(),
            to: email,
            subject,
            text: isHtml ? undefined : message,
            html:
              templateMode === 'branded'
                ? brandedTemplate(subject, isHtml ? message : textToHtml(message))
                : (isHtml ? message : textToHtml(message)),
          });

          // Handle API response errors
          if (response.error) {
            const errorMsg = response.error.message || 'Email delivery failed';
            console.error(`[sendBulkEmail] Error for ${email}: ${errorMsg}`);
            return { ok: false, email, error: errorMsg };
          }

          // Success - email was accepted by Resend
          return { ok: true, email };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Email delivery failed';
          console.error(`[sendBulkEmail] Exception for ${email}: ${errorMsg}`);
          return {
            ok: false,
            email,
            error: errorMsg,
          };
        }
      })
    );

    // Step 4: Record batch results
    for (const item of batchResults) {
      if (item.ok) {
        result.sent += 1;
      } else {
        result.failed += 1;
        // Only store first 20 failures to avoid huge responses
        if (result.failures.length < 20) {
          result.failures.push({ email: item.email, error: item.error });
        }
      }
    }
    
    // Add small delay between batches to avoid rate limiting
    if (i + batchSize < uniqueRecipients.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Log summary
  console.log(`[sendBulkEmail] Completed - Attempted: ${result.attempted}, Sent: ${result.sent}, Failed: ${result.failed}`);

  return result;
};
