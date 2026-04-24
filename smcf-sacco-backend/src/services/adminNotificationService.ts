/**
 * Admin Notification Service
 * Sends email notifications to admin for system activities
 * Fire-and-forget pattern to never block main request
 */

import { sendBulkEmail } from './emailService';
import User from '../models/User';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'ianabungana5@gmail.com').split(',').map(e => e.trim());

export interface ActivityNotification {
  type: 'LOAN_REQUEST' | 'LOAN_APPROVED' | 'LOAN_DISBURSED' | 'PAYMENT_RECEIVED' | 'DEFAULT_ALERT' | 
         'MEMBER_REGISTERED' | 'MEMBER_KYC' | 'SHARE_PURCHASED' | 'DIVIDEND_DECLARED' | 
         'LARGE_TRANSACTION' | 'SYSTEM_ERROR' | 'ACTIVITY_ALERT';
  title: string;
  description: string;
  details?: Record<string, any>;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  actor?: {
    id?: string;
    name?: string;
    role?: string;
  };
  timestamp?: Date;
}

/**
 * Generate HTML email template for admin notification
 */
function generateActivityEmailTemplate(notification: ActivityNotification): {
  subject: string;
  html: string;
} {
  const { type, title, description, details, severity, actor, timestamp } = notification;
  
  // Color coding by severity
  const severityColors: Record<string, string> = {
    low: '#3b82f6',
    medium: '#f59e0b', 
    high: '#ef4444',
    critical: '#7c2d12'
  };
  
  const severityBgColors: Record<string, string> = {
    low: '#dbeafe',
    medium: '#fef3c7',
    high: '#fee2e2',
    critical: '#fed7aa'
  };
  
  const color = severityColors[severity || 'low'];
  const bgColor = severityBgColors[severity || 'low'];
  
  // Activity-specific icons
  const icons: Record<string, string> = {
    'LOAN_REQUEST': '📋',
    'LOAN_APPROVED': '✅',
    'LOAN_DISBURSED': '💰',
    'PAYMENT_RECEIVED': '✓',
    'DEFAULT_ALERT': '⚠️',
    'MEMBER_REGISTERED': '👤',
    'MEMBER_KYC': '🔍',
    'SHARE_PURCHASED': '📈',
    'DIVIDEND_DECLARED': '💵',
    'LARGE_TRANSACTION': '🚨',
    'SYSTEM_ERROR': '❌',
    'ACTIVITY_ALERT': '🔔'
  };
  
  const icon = icons[type] || '📌';
  const subject = `[SMCF SACCO] ${icon} ${title}`;
  
  // Build details table if available
  let detailsHtml = '';
  if (details && Object.keys(details).length > 0) {
    detailsHtml = `
      <div style="margin: 20px 0; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <table style="width: 100%; border-collapse: collapse;">
          ${Object.entries(details)
            .map(([key, value], index) => `
              <tr style="background: ${index % 2 === 0 ? '#f9fafb' : '#fff'}; border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 12px 16px; color: #6b7280; font-weight: 600; width: 35%;">${key}</td>
                <td style="padding: 12px 16px; color: #111827;">${formatDetailValue(value)}</td>
              </tr>
            `)
            .join('')}
        </table>
      </div>
    `;
  }
  
  // Actor information
  let actorHtml = '';
  if (actor?.name) {
    actorHtml = `
      <div style="margin: 16px 0; padding: 12px; background: #f3f4f6; border-left: 4px solid ${color}; border-radius: 4px;">
        <p style="margin: 0; color: #6b7280; font-size: 12px;">Triggered by: <strong>${actor.name}</strong>${actor.role ? ` (${actor.role})` : ''}</p>
      </div>
    `;
  }
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #111827; }
        .container { max-width: 640px; margin: 0 auto; background: #fff; }
      </style>
    </head>
    <body style="margin: 0; padding: 16px; background: #f3f4f6;">
      <div class="container" style="border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="padding: 20px; background: linear-gradient(135deg, #1f7a3e 0%, #0f5132 100%); color: #fff;">
          <p style="margin: 0 0 8px; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.9;">System Activity Notification</p>
          <h2 style="margin: 0; font-size: 24px; font-weight: 700;">${icon} ${title}</h2>
        </div>
        
        <!-- Severity Badge -->
        <div style="padding: 16px 20px; background: ${bgColor}; border-bottom: 1px solid #e5e7eb;">
          <span style="display: inline-block; padding: 4px 12px; background: ${color}; color: #fff; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase;">
            ${(severity || 'info').toUpperCase()} PRIORITY
          </span>
        </div>
        
        <!-- Body -->
        <div style="padding: 24px;">
          
          <!-- Description -->
          <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #374151;">
            ${description}
          </p>
          
          <!-- Actor -->
          ${actorHtml}
          
          <!-- Details Table -->
          ${detailsHtml}
          
          <!-- Timestamp -->
          <p style="margin: 20px 0 0; font-size: 12px; color: #9ca3af;">
            <strong>Timestamp:</strong> ${(timestamp || new Date()).toLocaleString('en-KE', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              timeZone: 'Africa/Nairobi'
            })}
          </p>
        </div>
        
        <!-- Footer -->
        <div style="padding: 16px 20px; background: #f9fafb; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
          <p style="margin: 0;">
            This is an automated notification from SMCF SACCO Management System. 
            <br/>Do not reply to this email. Log in to your dashboard for more details.
          </p>
        </div>
        
      </div>
      
      <!-- Unsubscribe link -->
      <div style="text-align: center; margin: 16px 0; color: #9ca3af; font-size: 11px;">
        <p style="margin: 0;">
          <a href="mailto:support@smcf.app" style="color: #0f7034; text-decoration: none;">Contact Support</a> | 
          <a href="https://smcf.app" style="color: #0f7034; text-decoration: none;">Dashboard</a>
        </p>
      </div>
    </body>
    </html>
  `;
  
  return { subject, html };
}

/**
 * Format detail value for display
 */
function formatDetailValue(value: any): string {
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  if (typeof value === 'number') {
    // Format currency if it looks like money
    if (value > 100) {
      return `KES ${value.toLocaleString()}`;
    }
  }
  if (typeof value === 'boolean') {
    return value ? '✅ Yes' : '❌ No';
  }
  return String(value);
}

/**
 * Send activity notification to admin(s)
 * Fire-and-forget - never throws to avoid blocking main request
 */
export async function notifyAdmin(notification: ActivityNotification): Promise<void> {
  try {
    // Validate admin emails are configured
    if (!ADMIN_EMAILS.length || !ADMIN_EMAILS[0]) {
      console.warn('[notifyAdmin] No admin emails configured. Set ADMIN_EMAILS env var.');
      return;
    }
    
    // Generate email
    const { subject, html } = generateActivityEmailTemplate(notification);
    
    // Send asynchronously without awaiting (fire-and-forget)
    sendBulkEmail({
      recipients: ADMIN_EMAILS,
      subject,
      message: html,
      isHtml: true,
      templateMode: 'branded'
    }).catch(err => {
      console.error('[notifyAdmin] Email send error:', err);
    });
    
  } catch (error) {
    console.error('[notifyAdmin] Error:', error);
    // Never throw - always fire-and-forget
  }
}

/**
 * High-level notification helper for common activities
 */

export async function notifyLoanRequest(
  loanId: string,
  memberId: string,
  memberName: string,
  amount: number,
  purpose: string
): Promise<void> {
  await notifyAdmin({
    type: 'LOAN_REQUEST',
    title: 'New Loan Application',
    description: `A new loan application has been submitted by ${memberName}`,
    severity: 'medium',
    details: {
      'Loan ID': loanId,
      'Member': memberName,
      'Amount Requested': `KES ${amount.toLocaleString()}`,
      'Purpose': purpose,
      'Status': 'Pending Review'
    }
  });
}

export async function notifyLoanApproved(
  loanId: string,
  memberName: string,
  amount: number,
  approvedBy: string
): Promise<void> {
  await notifyAdmin({
    type: 'LOAN_APPROVED',
    title: 'Loan Approved',
    description: `Loan application for ${memberName} has been approved`,
    severity: 'low',
    details: {
      'Loan ID': loanId,
      'Member': memberName,
      'Approved Amount': `KES ${amount.toLocaleString()}`,
      'Approved By': approvedBy
    }
  });
}

export async function notifyLoanDisbursed(
  loanId: string,
  memberName: string,
  amount: number
): Promise<void> {
  await notifyAdmin({
    type: 'LOAN_DISBURSED',
    title: 'Loan Disbursed',
    description: `Loan of KES ${amount.toLocaleString()} has been disbursed to ${memberName}`,
    severity: 'low',
    details: {
      'Loan ID': loanId,
      'Member': memberName,
      'Disbursed Amount': `KES ${amount.toLocaleString()}`,
      'Disbursement Status': 'Completed'
    }
  });
}

export async function notifyPaymentReceived(
  memberName: string,
  amount: number,
  paymentType: string
): Promise<void> {
  await notifyAdmin({
    type: 'PAYMENT_RECEIVED',
    title: 'Payment Received',
    description: `A payment of KES ${amount.toLocaleString()} has been received from ${memberName}`,
    severity: 'low',
    details: {
      'Member': memberName,
      'Amount': `KES ${amount.toLocaleString()}`,
      'Payment Type': paymentType,
      'Status': 'Completed'
    }
  });
}

export async function notifyDefaultAlert(
  memberId: string,
  memberName: string,
  loanId: string,
  daysOverdue: number
): Promise<void> {
  await notifyAdmin({
    type: 'DEFAULT_ALERT',
    title: 'Loan Default Alert',
    description: `${memberName} has a loan in default for ${daysOverdue} days`,
    severity: 'high',
    details: {
      'Member': memberName,
      'Loan ID': loanId,
      'Days Overdue': daysOverdue,
      'Action Required': 'Follow-up needed'
    }
  });
}

export async function notifyMemberRegistered(
  memberId: string,
  memberName: string,
  email: string
): Promise<void> {
  await notifyAdmin({
    type: 'MEMBER_REGISTERED',
    title: 'New Member Registered',
    description: `A new member ${memberName} has registered in the system`,
    severity: 'low',
    details: {
      'Member ID': memberId,
      'Name': memberName,
      'Email': email,
      'Status': 'Pending KYC Verification'
    }
  });
}

export async function notifyMemberKYCCompleted(
  memberId: string,
  memberName: string
): Promise<void> {
  await notifyAdmin({
    type: 'MEMBER_KYC',
    title: 'KYC Verification Completed',
    description: `KYC verification for ${memberName} has been completed`,
    severity: 'low',
    details: {
      'Member ID': memberId,
      'Name': memberName,
      'Verification Status': 'Completed'
    }
  });
}

export async function notifyLargeTransaction(
  transactionType: string,
  amount: number,
  actorName: string
): Promise<void> {
  await notifyAdmin({
    type: 'LARGE_TRANSACTION',
    title: 'Large Transaction Alert',
    description: `A large ${transactionType} transaction of KES ${amount.toLocaleString()} has been processed`,
    severity: 'high',
    details: {
      'Transaction Type': transactionType,
      'Amount': `KES ${amount.toLocaleString()}`,
      'Initiated By': actorName,
      'Threshold': 'Exceeds notification limit'
    }
  });
}

export async function notifySystemError(
  errorType: string,
  errorMessage: string,
  context?: string
): Promise<void> {
  await notifyAdmin({
    type: 'SYSTEM_ERROR',
    title: 'System Error Alert',
    description: `An error has occurred in the system: ${errorType}`,
    severity: 'critical',
    details: {
      'Error Type': errorType,
      'Message': errorMessage,
      ...(context && { 'Context': context })
    }
  });
}

/**
 * Get admin email configuration status
 */
export function getAdminNotificationStatus() {
  return {
    configured: ADMIN_EMAILS.length > 0 && ADMIN_EMAILS[0].length > 0,
    adminEmails: ADMIN_EMAILS,
    status: ADMIN_EMAILS.length > 0 && ADMIN_EMAILS[0] ? 'active' : 'not configured'
  };
}
