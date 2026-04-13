import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import Loan from '../models/Loan';
import LoanGuarantor from '../models/LoanGuarantor';
import LoanApproval from '../models/LoanApproval';
import Member from '../models/Member';
import RepaymentRecord from '../models/RepaymentRecord';
import SystemConfig from '../models/SystemConfig';
import User from '../models/User';
import Shareholder from '../models/Shareholder';
import Transaction from '../models/Transaction';
import { protect, authorize, AuthRequest } from '../middleware/auth';
import { auditLog } from '../middleware/auditLog';
import { notifyMember, notifyStaff } from '../utils/notify';

const router = Router();

const LOAN_TYPES: Record<string, { label: string; rate: number; minMonths: number; maxMonths: number }> = {
  business_development: { label: 'Business Development Loan', rate: 4, minMonths: 3, maxMonths: 12 },
  education: { label: 'Education Loan', rate: 2.5, minMonths: 3, maxMonths: 6 },
  emergency: { label: 'Emergency Loan', rate: 3, minMonths: 1, maxMonths: 2 },
  asset_acquisition: { label: 'Asset Acquisition Loan', rate: 3, minMonths: 4, maxMonths: 8 },
  personal: { label: 'Personal Loan', rate: 6, minMonths: 1, maxMonths: 3 },
};

function addMonths(base: Date, months: number) {
  const next = new Date(base);
  next.setMonth(next.getMonth() + months);
  return next;
}

async function createRepaymentSchedule(loan: any, startDate: Date) {
  const existing = await RepaymentRecord.countDocuments({ loanId: loan._id });
  if (existing > 0) return;

  const termMonths = Math.max(1, Number(loan.termMonths || 0));
  const totalPayable = Number(loan.totalPayable || 0);
  const baseInstallment = Number(loan.monthlyInstallment || 0);

  let remaining = totalPayable;
  const rows = Array.from({ length: termMonths }, (_, index) => {
    const month = index + 1;
    const amountDue = month === termMonths
      ? Math.round(remaining)
      : Math.round(baseInstallment || (totalPayable / termMonths));
    remaining = Math.max(0, remaining - amountDue);

    return {
      loanId: loan._id,
      memberId: loan.memberId,
      dueDate: addMonths(startDate, month),
      amountDue,
      amountPaid: 0,
      penaltyAmount: 0,
      status: 'pending',
    };
  });

  if (rows.length > 0) {
    await RepaymentRecord.insertMany(rows);
  }
}

// @route   GET /api/loans
// @desc    Get all loans (with optional filters)
// @access  Private
router.get('/', protect, async (req, res, next) => {
  try {
    const { status, memberId, guarantorMemberId } = req.query;
    let filter: any = {};
    if (status)   filter.status   = status;
    if (memberId) filter.memberId = memberId;

    let loanIds: any[] | undefined;
    if (guarantorMemberId) {
      const gRecords = await LoanGuarantor.find({ memberId: guarantorMemberId }).select('loanId');
      loanIds = gRecords.map((g) => g.loanId);
      filter._id = { $in: loanIds };
    }

    const loans = await Loan.find(filter)
      .populate('memberId', 'name memberId savings')
      .populate('appliedBy approvedBy', 'email fullName')
      .sort({ createdAt: -1 });

    // Attach guarantors and approvals
    const loanDocs = await Promise.all(
      loans.map(async (loan: any) => {
        const [guarantors, approvals] = await Promise.all([
          LoanGuarantor.find({ loanId: loan._id }).populate('memberId', 'name memberId savings'),
          LoanApproval.find({ loanId: loan._id }).populate('approverId', 'email fullName'),
        ]);
        return { ...loan.toObject(), guarantors, approvals };
      })
    );

    res.json({ success: true, count: loanDocs.length, data: loanDocs });
  } catch (error) {
    next(error);
  }
});


// @route   GET /api/loans/:id
// @desc    Get single loan with guarantors
// @access  Private
router.get('/:id', protect, async (req, res, next) => {
  try {
    const loan = await Loan.findById(req.params.id)
      .populate('memberId', 'name memberId email phone')
      .populate('appliedBy approvedBy', 'email fullName');

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      });
    }

    // Get guarantors and approvals
    const [guarantors, approvals] = await Promise.all([
      LoanGuarantor.find({ loanId: loan._id }).populate('memberId', 'name memberId savings'),
      LoanApproval.find({ loanId: loan._id }).populate('approverId', 'email fullName'),
    ]);

    res.json({
      success: true,
      data: {
        ...loan.toObject(),
        guarantors,
        approvals
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/loans/:id
// @desc    Delete a loan and related records (admin only)
// @access  Private (Admin only)
router.delete(
  '/:id',
  protect,
  authorize('admin'),
  auditLog('loans', 'delete'),
  async (req: AuthRequest, res, next) => {
    try {
      const loan = await Loan.findById(req.params.id);
      if (!loan) {
        return res.status(404).json({ success: false, message: 'Loan not found' });
      }

      const loanId = loan._id;
      const memberId = loan.memberId;

      await Promise.all([
        Loan.deleteOne({ _id: loanId }),
        LoanApproval.deleteMany({ loanId }),
        LoanGuarantor.deleteMany({ loanId }),
        RepaymentRecord.deleteMany({ loanId }),
        Transaction.deleteMany({ loanId: String(loanId) }),
      ]);

      const [remainingBalanceAgg, memberDoc] = await Promise.all([
        Loan.aggregate([
          { $match: { memberId, status: { $in: ['active', 'disbursed'] } } },
          { $group: { _id: null, total: { $sum: '$balance' } } }
        ]),
        Member.findById(memberId).select('memberId').lean(),
      ]);

      const remainingBalance = remainingBalanceAgg[0]?.total || 0;
      await Member.findByIdAndUpdate(memberId, { $set: { loanBalance: remainingBalance } });

      const memberCode = (memberDoc as any)?.memberId;
      if (memberCode) {
        await Shareholder.findOneAndUpdate(
          { memberId: memberCode },
          { $set: { loanBalance: remainingBalance } }
        );
      }

      res.json({ success: true, message: 'Loan deleted', data: { id: String(loanId) } });
    } catch (error) {
      next(error);
    }
  }
);

// @route   GET /api/loans/:id/approvals
// @desc    Get approvals for a loan
// @access  Private
router.get('/:id/approvals', protect, async (req, res, next) => {
  try {
    const approvals = await LoanApproval.find({ loanId: req.params.id })
      .populate('approverId', 'email fullName')
      .sort({ createdAt: 1 });
    res.json({ success: true, count: approvals.length, data: approvals });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/loans/:id/approvals
// @desc    Submit approval decision for a loan
// @access  Private (staff only)
router.post(
  '/:id/approvals',
  protect,
  authorize('admin', 'credit_officer', 'credit_committee'),
  auditLog('loans', 'approve'),
  [
    body('approvalLevel').notEmpty().withMessage('Approval level is required'),
    body('decision').isIn(['approved', 'rejected']).withMessage('Decision must be approved or rejected'),
  ],
  async (req: AuthRequest, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

      const { approvalLevel, decision, notes } = req.body;
      const loanId = req.params.id;

      await LoanApproval.create({ loanId, approverId: req.userId, approvalLevel, decision, notes: notes || null });

      if (decision === 'rejected') {
        const rejectedLoan = await Loan.findByIdAndUpdate(loanId, { status: 'rejected', rejectionReason: notes }, { new: true });
        if (rejectedLoan) {
          notifyMember(
            rejectedLoan.memberId,
            'Loan Application Rejected',
            `Your loan application ${rejectedLoan.loanNumber} was not approved. Reason: ${notes || 'No reason provided'}`,
            'rejection',
            '/loans'
          );
        }
      } else {
        const loan = await Loan.findById(loanId);
        if (loan) {
          const config = await SystemConfig.getConfig();
          const autoApproveLimit = Math.max(0, Number(config.autoApproveLimit || 0));
          const committeeThreshold = Math.max(autoApproveLimit, Number(config.committeeThreshold || 0));

          const baseRequired =
            loan.principal <= autoApproveLimit ? ['credit_officer'] :
            loan.principal <= committeeThreshold ? ['credit_officer', 'credit_committee'] :
            ['credit_officer', 'credit_committee', 'board'];

          const availableRoles = new Set(
            (await User.distinct('roles')).map((r) => String(r))
          );
          const required = baseRequired.filter((role) => availableRoles.has(role));
          const approvedLevels = await LoanApproval.find({ loanId, decision: 'approved' }).distinct('approvalLevel');
          const allDone = required.length === 0
            ? true
            : required.every((l) => approvedLevels.includes(l) || l === approvalLevel);
          if (allDone) {
            await Loan.findByIdAndUpdate(loanId, { status: 'approved', approvedAt: new Date(), approvedBy: req.userId });
            notifyMember(
              loan.memberId,
              'Loan Approved ✅',
              `Your loan application ${loan.loanNumber} for KES ${Number(loan.principal).toLocaleString()} has been fully approved.`,
              'approval',
              '/loans'
            );
          }
        }
      }

      res.status(201).json({ success: true, message: 'Decision recorded' });
    } catch (error) {
      next(error);
    }
  }
);

// @route   POST /api/loans
// @desc    Apply for a loan
// @access  Private
router.post(
  '/',
  protect,
  auditLog('loans', 'create'),
  [
    body('memberId').notEmpty().withMessage('Member ID is required'),
    body('principal').isNumeric().withMessage('Principal amount is required'),
    body('loanType').notEmpty().withMessage('Loan type is required'),
    body('termMonths').isInt({ min: 1 }).withMessage('Term months must be at least 1'),
    body('guarantors').optional().isArray()
  ],
  async (req: AuthRequest, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { memberId, principal, loanType, termMonths, guarantors } = req.body;

      const loanTypeConfig = LOAN_TYPES[String(loanType)];
      if (!loanTypeConfig) {
        return res.status(400).json({ success: false, message: 'Invalid loan type selected' });
      }

      if (termMonths < loanTypeConfig.minMonths || termMonths > loanTypeConfig.maxMonths) {
        return res.status(400).json({
          success: false,
          message: `Duration must be between ${loanTypeConfig.minMonths} and ${loanTypeConfig.maxMonths} months for ${loanTypeConfig.label}.`,
        });
      }

      const member = await Member.findById(memberId).select('status').lean();
      if (!member) return res.status(404).json({ success: false, message: 'Member not found' });
      if ((member as any).status !== 'active') {
        return res.status(400).json({ success: false, message: 'Member is not active' });
      }

      const activeLoans = await Loan.countDocuments({
        memberId,
        status: { $in: ['active', 'disbursed'] },
      });
      if (activeLoans >= 2) {
        return res.status(400).json({ success: false, message: 'Maximum 2 active loans allowed' });
      }

      // Generate loan number
      const count = await Loan.countDocuments();
      const loanNumber = `LN${new Date().getFullYear()}${String(count + 1).padStart(5, '0')}`;

      // Calculate loan details using flat monthly interest
      const monthlyInterestRate = loanTypeConfig.rate / 100;
      const monthlyInterest = Math.round(principal * monthlyInterestRate);
      const totalInterest = Math.round(monthlyInterest * termMonths);
      const totalPayable = Math.round(principal + totalInterest);
      const monthlyInstallment = termMonths > 0 ? Math.round(totalPayable / termMonths) : 0;

      // Create loan
      const loan = await Loan.create({
        loanNumber,
        memberId,
        principal,
        loanType,
        interestRate: loanTypeConfig.rate,
        termMonths,
        monthlyInterest,
        totalInterest,
        monthlyInstallment,
        totalPayable,
        balance: totalPayable,
        appliedBy: req.userId,
        interestModel: 'flat',
        status: 'pending'
      });

      // Add guarantors if provided and notify each one for consent
      if (guarantors && guarantors.length > 0) {
        await LoanGuarantor.insertMany(
          guarantors.map((g: any) => ({
            loanId: loan._id,
            memberId: g.memberId,
            guaranteeAmount: g.guaranteeAmount || 0,
            consentStatus: 'pending',
          }))
        );

        // Resolve applicant member name for the notification message
        const applicantMember = await Member.findById(memberId).select('name').lean();
        const applicantName = (applicantMember as any)?.name ?? 'A member';

        // Notify every guarantor — they must accept/decline from their account
        guarantors.forEach((g: any) => {
          notifyMember(
            g.memberId,
            'Guarantor Consent Required',
            `${applicantName} has selected you as a guarantor for loan ${loanNumber} (KES ${Number(principal).toLocaleString()}). Please review and respond in your account.`,
            'info',
            '/my-account'
          );
        });
      }

      // Notify all staff that a new loan application is pending
      notifyStaff(
        'New Loan Application',
        `Loan ${loanNumber} for KES ${Number(principal).toLocaleString()} has been submitted and is awaiting approval.`,
        'info',
        '/loans/approvals'
      );

      res.status(201).json({
        success: true,
        data: loan
      });
    } catch (error) {
      next(error);
    }
  }
);

// @route   PUT /api/loans/:id/approve
// @desc    Approve a loan
// @access  Private (Staff only)
router.put(
  '/:id/approve',
  protect,
  authorize('admin', 'credit_officer', 'credit_committee'),
  auditLog('loans', 'approve'),
  async (req: AuthRequest, res, next) => {
    try {
      const loan = await Loan.findByIdAndUpdate(
        req.params.id,
        {
          status: 'approved',
          approvedAt: new Date(),
          approvedBy: req.userId
        },
        { new: true }
      );

      if (!loan) {
        return res.status(404).json({
          success: false,
          message: 'Loan not found'
        });
      }

      // Notify the member their loan was approved
      notifyMember(
        loan.memberId,
        'Loan Approved ✅',
        `Your loan application ${loan.loanNumber} for KES ${Number(loan.principal).toLocaleString()} has been approved.`,
        'approval',
        '/loans'
      );

      res.json({
        success: true,
        data: loan
      });
    } catch (error) {
      next(error);
    }
  }
);

// @route   PUT /api/loans/:id/reject
// @desc    Reject a loan
// @access  Private (Staff only)
router.put(
  '/:id/reject',
  protect,
  authorize('admin', 'credit_officer', 'credit_committee'),
  auditLog('loans', 'reject'),
  [body('reason').notEmpty().withMessage('Rejection reason is required')],
  async (req: AuthRequest, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const loan = await Loan.findByIdAndUpdate(
        req.params.id,
        {
          status: 'rejected',
          rejectionReason: req.body.reason,
          approvedBy: req.userId
        },
        { new: true }
      );

      if (!loan) {
        return res.status(404).json({
          success: false,
          message: 'Loan not found'
        });
      }

      // Notify the member their loan was rejected
      notifyMember(
        loan.memberId,
        'Loan Application Rejected',
        `Your loan application ${loan.loanNumber} was not approved. Reason: ${req.body.reason}`,
        'rejection',
        '/loans'
      );

      res.json({
        success: true,
        data: loan
      });
    } catch (error) {
      next(error);
    }
  }
);

// @route   GET /api/loans/guarantor-requests
// @desc    Get all pending guarantor consent requests for the logged-in member
// @access  Private
router.get('/guarantor-requests/me', protect, async (req: AuthRequest, res, next) => {
  try {
    // Resolve the Member document that belongs to this user
    const myMember = await Member.findOne({ userId: req.userId }).select('_id').lean();
    if (!myMember) return res.json({ success: true, data: [] });

    const records = await LoanGuarantor.find({ memberId: (myMember as any)._id })
      .populate({
        path: 'loanId',
        select: 'loanNumber principal loanType interestRate interestModel termMonths monthlyInstallment monthlyInterest totalInterest totalPayable status memberId',
        populate: { path: 'memberId', select: 'name memberId' },
      })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: records });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/loans/:loanId/guarantors/respond
// @desc    Guarantor accepts or rejects their consent request
// @access  Private
router.put(
  '/:loanId/guarantors/respond',
  protect,
  [body('decision').isIn(['accepted', 'rejected']).withMessage('Decision must be accepted or rejected')],
  async (req: AuthRequest, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

      const { decision, note } = req.body;

      // Find the member linked to this user
      const myMember = await Member.findOne({ userId: req.userId }).select('_id name').lean();
      if (!myMember) return res.status(404).json({ success: false, message: 'Member profile not found' });

      const record = await LoanGuarantor.findOne({
        loanId: req.params.loanId,
        memberId: (myMember as any)._id,
      });

      if (!record) return res.status(404).json({ success: false, message: 'Guarantor record not found' });
      if (record.consentStatus !== 'pending') {
        return res.status(400).json({ success: false, message: `Already responded: ${record.consentStatus}` });
      }

      record.consentStatus = decision;
      record.responseNote  = note || null;
      record.respondedAt   = new Date();
      await record.save();

      // Notify the loan applicant about the response
      const loan = await Loan.findById(req.params.loanId).select('loanNumber memberId principal').lean();
      if (loan) {
        const guarantorName = (myMember as any).name ?? 'A guarantor';
        notifyMember(
          (loan as any).memberId,
          decision === 'accepted' ? 'Guarantor Consent Accepted ✅' : 'Guarantor Consent Declined ❌',
          decision === 'accepted'
            ? `${guarantorName} has agreed to guarantee your loan ${(loan as any).loanNumber}.`
            : `${guarantorName} has declined to guarantee your loan ${(loan as any).loanNumber}${note ? `: ${note}` : '.'} You may need to select another guarantor.`,
          decision === 'accepted' ? 'approval' : 'rejection',
          '/loans'
        );

        // If rejected, let staff know too so they can flag the application
        if (decision === 'rejected') {
          notifyStaff(
            'Guarantor Declined Consent',
            `${guarantorName} declined to guarantee loan ${(loan as any).loanNumber}. The application may need review.`,
            'info',
            '/loans/approvals'
          );
        }
      }

      res.json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  }
);

// @route   PUT /api/loans/:id/disburse
// @desc    Disburse an approved loan (move to "active" status)
// @access  Private (Staff only)
router.put(
  '/:id/disburse',
  protect,
  authorize('admin', 'credit_officer', 'treasurer'),
  auditLog('loans', 'disburse'),
  async (req: AuthRequest, res, next) => {
    try {
      const loan = await Loan.findById(req.params.id);
      if (!loan) {
        return res.status(404).json({ success: false, message: 'Loan not found' });
      }

      if (loan.status !== 'approved') {
        return res.status(400).json({
          success: false,
          message: `Loan is not in approved status. Current status: ${loan.status}`
        });
      }

      // Update loan to active status (ready for repayments)
      loan.status = 'active';
      loan.disbursedDate = new Date();
      await loan.save();

      await createRepaymentSchedule(loan, loan.disbursedDate);

      // Update member's loan balance
      await Member.findByIdAndUpdate(loan.memberId, {
        $inc: { loanBalance: loan.principal }
      });

      // Notify the member their loan was disbursed
      notifyMember(
        loan.memberId,
        'Loan Disbursed',
        `Your loan application ${loan.loanNumber} for KES ${loan.principal.toLocaleString()} has been approved and disbursed. The amount should reflect in your account within 1-2 business days.`,
        'approval',
        '/my-account?tab=loans'
      );

      // Notify staff
      notifyStaff(
        `Loan ${loan.loanNumber} disbursed for KES ${loan.principal.toLocaleString()}`,
        `/loans`
      );

      res.json({ success: true, data: loan });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
