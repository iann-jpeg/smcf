import { Resend } from 'resend';
import crypto from 'crypto';

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Generate a verification token
 */
export const generateVerificationToken = (): { token: string; hash: string; expiresIn: Date } => {
  const token = crypto.randomBytes(32).toString('hex');
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
    const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${verificationToken}`;

    const result = await resend.emails.send({
      from: 'noreply@smcfsacco.co.ke',
      to: email,
      subject: 'Verify Your Email Address - SMCF SACCO',
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
 * Verify the email token
 */
export const verifyEmailToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};
