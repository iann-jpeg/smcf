import { Router } from 'express';
import Member from '../models/Member';
import Transaction from '../models/Transaction';
import Loan from '../models/Loan';
import { authorize, AuthRequest, protect } from '../middleware/auth';
import { recordUserActivity } from '../utils/userActivity';

const router = Router();
router.get('/', protect, authorize('admin', 'treasurer', 'credit_officer', 'auditor'), async (req: AuthRequest, res, next) => {
  try {
    const query = String(req.query.q || '').trim();
    if (query.length < 2) return res.status(400).json({ success: false, message: 'Search query must contain at least 2 characters' });
    const expression = { $regex: query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    const [members, transactions, loans] = await Promise.all([
      Member.find({ $or: [{ name: expression }, { memberId: expression }, { phone: expression }, { email: expression }] }).select('name memberId phone email status').limit(10).lean(),
      Transaction.find({ $or: [{ transactionRef: expression }, { mpesaRef: expression }, { description: expression }] }).select('transactionRef amount type status processedAt memberId').limit(10).lean(),
      Loan.find({ loanNumber: expression }).select('loanNumber amount status memberId').limit(10).lean(),
    ]);
    recordUserActivity(req, {
      userId: (req as AuthRequest).userId,
      event: 'search',
      action: 'Global search',
      path: '/admin/search',
      searchCategories: ['members', 'transactions', 'loans'],
      resultCount: members.length + transactions.length + loans.length,
      metadata: { queryLength: query.length },
    });
    return res.json({ success: true, data: { members, transactions, loans } });
  } catch (error) {
    return next(error);
  }
});
export default router;
