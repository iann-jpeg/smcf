/**
 * INTEGRATION EXAMPLE: Loan Routes with Admin Notifications
 * 
 * This file shows how to integrate admin email notifications into your routes.
 * Copy and adapt these patterns to your actual route handlers.
 * 
 * Location: src/routes/loans.ts (or similar)
 * 
 * NOTE: This is example code showing how to use the adminNotificationService.
 * Adapt to your actual models and business logic as needed.
 */

import express, { Response } from 'express';
import { protect, authorize, AuthRequest } from '../middleware/auth';
import Loan, { ILoan } from '../models/Loan';
import Member, { IMember } from '../models/Member';
import {
  notifyLoanRequest,
  notifyLoanApproved,
  notifyLoanDisbursed,
  notifyDefaultAlert,
  notifySystemError
} from '../services/adminNotificationService';

const router = express.Router();

// ============================================================================
// EXAMPLE 1: Create Loan Request with Admin Notification
// ============================================================================

/**
 * POST /api/loans
 * Create a new loan application
 * Automatically notifies admins
 */
router.post('/', protect, authorize('member'), async (req: AuthRequest, res: Response) => {
  try {
    const { principal, interestRate, termMonths } = req.body;
    const memberId = (req.user as any)?._id || (req.user as any)?.memberId;

    // Validate inputs
    if (!principal || principal <= 0) {
      return res.status(400).json({ error: 'Invalid loan amount' });
    }

    // Get member details for notification
    const member = await Member.findById(memberId).select('name email') as IMember | null;
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Create the loan
    const loan = new Loan({
      memberId,
      principal,
      interestRate,
      termMonths,
      status: 'pending',
      appliedAt: new Date()
    });

    await loan.save();

    // ✨ NOTIFY ADMIN (fire-and-forget, never blocks response)
    await notifyLoanRequest(
      (loan as ILoan)._id.toString(),
      memberId,
      member.name,
      principal,
      `Loan request for KES ${principal}`
    );

    res.status(201).json({
      message: 'Loan application submitted successfully',
      loan
    });

  } catch (error) {
    console.error('Loan creation error:', error);
    
    // ✨ NOTIFY ADMIN OF ERROR (fire-and-forget)
    await notifySystemError(
      'Loan Creation Failed',
      error instanceof Error ? error.message : 'Unknown error',
      'POST /api/loans'
    );

    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to create loan'
    });
  }
});

// ============================================================================
// EXAMPLE 2: Approve Loan with Admin Notification
// ============================================================================

/**
 * PATCH /api/loans/:id/approve
 * Approve a pending loan application
 * Notifies admin
 */
router.patch('/:id/approve', protect, authorize('admin', 'credit_committee'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const approverName = (req.user as any)?.name || 'System';

    // Find and update loan
    const loan = await Loan.findByIdAndUpdate(
      id,
      {
        status: 'approved',
        approvalDate: new Date(),
        approvedAt: new Date(),
        approvedBy: (req.user as any)?._id
      },
      { new: true }
    ) as ILoan | null;

    if (!loan) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    // Get member details for notification
    const member = await Member.findById(loan.memberId).select('name email') as IMember | null;
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // ✨ NOTIFY ADMIN (fire-and-forget)
    await notifyLoanApproved(
      loan._id.toString(),
      member.name,
      loan.principal,
      approverName
    );

    res.json({
      message: 'Loan approved successfully',
      loan
    });

  } catch (error) {
    console.error('Loan approval error:', error);
    
    // ✨ NOTIFY ADMIN OF ERROR
    await notifySystemError(
      'Loan Approval Failed',
      error instanceof Error ? error.message : 'Unknown error',
      `PATCH /api/loans/${req.params.id}/approve`
    );

    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to approve loan'
    });
  }
});

// ============================================================================
// EXAMPLE 3: Disburse Loan with Admin Notification
// ============================================================================

/**
 * PATCH /api/loans/:id/disburse
 * Disburse approved loan to member's account
 * Notifies admin
 */
router.patch('/:id/disburse', protect, authorize('admin', 'treasurer'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Find loan
    const loan = await Loan.findById(id) as ILoan | null;
    if (!loan) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    if (loan.status !== 'approved') {
      return res.status(400).json({ error: 'Only approved loans can be disbursed' });
    }

    // Get member details
    const member = await Member.findById(loan.memberId).select('name email phone') as IMember | null;
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Process disbursement (M-Pesa, bank transfer, etc.)
    const disbursementResult = await processDisbursement(member, loan.principal);

    if (!disbursementResult.success) {
      throw new Error(`Disbursement failed: ${disbursementResult.error}`);
    }

    // Update loan status
    loan.status = 'disbursed';
    loan.disbursedDate = new Date();
    await loan.save();

    // ✨ NOTIFY ADMIN (fire-and-forget)
    await notifyLoanDisbursed(
      loan._id.toString(),
      member.name,
      loan.principal
    );

    res.json({
      message: 'Loan disbursed successfully',
      referenceNumber: disbursementResult.referenceNumber,
      loan
    });

  } catch (error) {
    console.error('Loan disbursement error:', error);
    
    // ✨ NOTIFY ADMIN OF ERROR (critical!)
    await notifySystemError(
      'Loan Disbursement Failed',
      error instanceof Error ? error.message : 'Unknown error',
      `PATCH /api/loans/${req.params.id}/disburse`
    );

    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to disburse loan'
    });
  }
});

// ============================================================================
// HELPER: Process disbursement (M-Pesa, bank, etc.)
// ============================================================================

async function processDisbursement(member: any, amount: number) {
  try {
    // Your actual disbursement logic here
    // e.g., M-Pesa API, bank transfer, wallet credit, etc.
    
    // For this example, we'll simulate it
    const referenceNumber = `DISB-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    return {
      success: true,
      referenceNumber,
      timestamp: new Date()
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Disbursement failed'
    };
  }
}

// ============================================================================
// EXAMPLE 4: Cron Job - Daily Default Check
// ============================================================================

/**
 * This would typically run as a cron job (e.g., node-schedule)
 * Call this function daily to check for loan defaults
 */
export async function checkLoanDefaults() {
  console.log('[Cron] Checking for loan defaults...');
  
  try {
    // Find all active loans
    const activeLoans = await Loan.find({
      status: { $in: ['active', 'disbursed'] }
    }).populate('memberId', 'name email') as any[];

    // Check each loan for potential defaults
    for (const loan of activeLoans) {
      // Note: Implement actual repayment tracking based on your system
      // This is a simplified example
      const member = loan.memberId as IMember;
      
      // Only notify for loans with potential issues
      if (member) {
        // ✨ NOTIFY ADMIN (fire-and-forget)
        await notifyDefaultAlert(
          loan.memberId.toString(),
          member.name,
          loan._id.toString(),
          0 // Adjust based on your repayment tracking logic
        );

        console.log(
          `[Default Alert] Loan ${loan._id} for ${member.name} checked`
        );
      }
    }

    console.log(`[Cron] Default check completed. Checked ${activeLoans.length} active loans.`);

  } catch (error) {
    console.error('[Cron] Error checking defaults:', error);
    
    // ✨ NOTIFY ADMIN OF CRON ERROR
    await notifySystemError(
      'Cron Job Failed: Loan Default Check',
      error instanceof Error ? error.message : 'Unknown error',
      'Daily loan default check'
    );
  }
}

// ============================================================================
// EXAMPLE 5: Get Loan Details
// ============================================================================

/**
 * GET /api/loans/:id
 * Admin can get full loan details
 * Could optionally log access to sensitive loans
 */
router.get('/:id', protect, async (req: AuthRequest, res: Response) => {
  try {
    const loan = await Loan.findById(req.params.id)
      .populate('memberId', 'name email')
      .populate('approvedBy', 'name');

    if (!loan) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    // Optional: log access to large loans for audit purposes
    const LARGE_LOAN_THRESHOLD = 500000;
    if (loan.principal > LARGE_LOAN_THRESHOLD && (req.user as any)?.role === 'admin') {
      // Log that large loan was accessed (optional)
      console.log(`[Audit] ${(req.user as any)?.name} accessed large loan ${loan._id}`);
    }

    res.json(loan);

  } catch (error) {
    console.error('Get loan error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch loan'
    });
  }
});

export default router;

/**
 * INTEGRATION CHECKLIST
 * 
 * ✅ Import notification functions at top of file
 * ✅ Add fire-and-forget notification calls in route handlers
 * ✅ Pass accurate, detailed information to notification functions
 * ✅ Include member/transaction IDs for reference
 * ✅ Use appropriate severity levels
 * ✅ Never throw from notification calls
 * ✅ Test with actual admin emails before production
 * ✅ Monitor logs for email delivery errors
 * ✅ Add notifications to error handlers
 * ✅ Document which activities trigger notifications
 */
