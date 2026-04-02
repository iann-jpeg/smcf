import express from 'express';
import Member from '../models/Member.js';
import Loan from '../models/Loan.js';
import Payment from '../models/Payment.js';
import Saving from '../models/Saving.js';
import Cycle from '../models/Cycle.js';
import Announcement from '../models/Announcement.js';
import LoanGuarantor from '../models/LoanGuarantor.js';
import { protect } from '../middleware/auth.js';
import { cacheMiddleware } from '../utils/cache.js';

const router = express.Router();

router.use(protect);

/**
 * GET /api/member-dashboard/:memberId
 * Optimized single endpoint to fetch all member dashboard data
 * Reduces HTTP requests from 8 to 1
 * Cached for 2 minutes
 */
router.get('/member-dashboard/:memberId', cacheMiddleware(2 * 60 * 1000), async (req, res) => {
  try {
    const { memberId } = req.params;
    const isWalletOnly = req.query.wallet_only === 'true';

    // Parallel fetch all required data
    const [
      member,
      currentCycle,
      memberLoans,
      memberPayments,
      memberSavings,
      announcements,
      pendingGuarantorRequests
    ] = await Promise.all([
      // Member data
      Member.findById(memberId).select('-password').lean(),
      
      // Current cycle (skip for wallet-only)
      isWalletOnly ? Promise.resolve(null) : 
        Cycle.findOne({ status: 'active' }).lean(),
      
      // Member loans
      Loan.find({ member_id: memberId })
        .sort({ disbursement_date: -1 })
        .limit(10)
        .lean(),
      
      // Member payments (last 10)
      Payment.find({ member_id: memberId })
        .sort({ transaction_date: -1 })
        .limit(10)
        .lean(),
      
      // Member savings summary
      Saving.aggregate([
        { $match: { member_id: memberId } },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ]),
      
      // Recent announcements (last 5)
      isWalletOnly ? Promise.resolve([]) :
        Announcement.find({ status: 'active' })
          .sort({ created_at: -1 })
          .limit(5)
          .select('title content created_at priority')
          .lean(),
      
      // Pending guarantor requests count
      LoanGuarantor.countDocuments({
        guarantor_id: memberId,
        status: 'pending'
      })
    ]);

    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    // Calculate member stats
    const hasPaidThisCycle = memberPayments.some(p => 
      currentCycle && 
      new Date(p.transaction_date) >= new Date(currentCycle.start_date)
    );

    // Format response
    const dashboardData = {
      member: {
        _id: member._id,
        member_id: member.member_id,
        name: member.name,
        phone: member.phone,
        email: member.email,
        profile_picture: member.profile_picture,
        status: member.status,
        member_type: member.member_type,
        position: member.position,
        monthly_contribution: member.monthly_contribution,
        total_contributed: member.total_contributed,
        total_received: member.total_received,
        total_savings: member.total_savings,
        wallet_balance: member.wallet_balance,
        join_date: member.join_date
      },
      
      currentCycle: currentCycle ? {
        cycle_number: currentCycle.cycle_number,
        status: currentCycle.status,
        start_date: currentCycle.start_date,
        end_date: currentCycle.end_date,
        contributions_per_member: currentCycle.contributions_per_member,
        total_expected: currentCycle.total_expected,
        total_collected: currentCycle.total_collected
      } : null,
      
      loans: {
        data: memberLoans,
        active: memberLoans.filter(l => l.status === 'active').length,
        totalBorrowed: memberLoans.reduce((sum, l) => sum + (l.amount || 0), 0),
        totalOutstanding: memberLoans
          .filter(l => l.status === 'active')
          .reduce((sum, l) => sum + (l.balance || 0), 0)
      },
      
      payments: {
        recent: memberPayments,
        count: memberPayments.length
      },
      
      savings: {
        totalSaved: memberSavings[0]?.total || 0,
        depositCount: memberSavings[0]?.count || 0
      },
      
      announcements: announcements,
      
      stats: {
        hasPaidThisCycle,
        pendingGuarantorRequests,
        nextPayoutCycle: member.next_payout_cycle || member.position
      }
    };

    res.json({
      success: true,
      data: dashboardData
    });

  } catch (error) {
    console.error('Error fetching member dashboard:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching dashboard data', 
      error: error.message 
    });
  }
});

/**
 * GET /api/member-dashboard/:memberId/wallet
 * Optimized endpoint for wallet-only data (faster loading)
 * Cached for 1 minute
 */
router.get('/member-dashboard/:memberId/wallet', cacheMiddleware(60 * 1000), async (req, res) => {
  try {
    const { memberId } = req.params;

    const [member, memberLoans, pendingGuarantorRequests] = await Promise.all([
      Member.findById(memberId)
        .select('_id member_id name phone wallet_balance total_savings')
        .lean(),
      
      Loan.find({ member_id: memberId, status: 'active' })
        .select('loan_id amount balance status')
        .lean(),
      
      LoanGuarantor.countDocuments({
        guarantor_id: memberId,
        status: 'pending'
      })
    ]);

    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    res.json({
      success: true,
      data: {
        member,
        loans: memberLoans,
        stats: {
          pendingGuarantorRequests,
          activeLoans: memberLoans.length,
          totalOutstanding: memberLoans.reduce((sum, l) => sum + (l.balance || 0), 0)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching wallet data:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching wallet data', 
      error: error.message 
    });
  }
});

export default router;
