import express from 'express';
import Member from '../models/Member.js';
import Loan from '../models/Loan.js';
import Payment from '../models/Payment.js';
import Saving from '../models/Saving.js';
import Cycle from '../models/Cycle.js';
import Announcement from '../models/Announcement.js';
import { protect } from '../middleware/auth.js';
import { searchTracker } from '../middleware/searchTracker.js';

const router = express.Router();

// Protect all search routes
router.use(protect);

/**
 * POST /api/search/members
 * Search members by name, phone, or member ID
 */
router.post('/members', searchTracker('members'), async (req, res) => {
  try {
    const { search, limit = 20 } = req.body;
    
    if (!search || search.trim().length === 0) {
      return res.json([]);
    }

    const searchTerm = search.trim();
    const query = {
      $or: [
        { name: { $regex: searchTerm, $options: 'i' } },
        { phone: { $regex: searchTerm, $options: 'i' } },
        { member_id: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } }
      ],
      status: 'active'
    };

    const members = await Member.find(query)
      .select('name phone member_id email profile_picture position')
      .limit(parseInt(limit))
      .sort({ position: 1 })
      .lean();

    res.json(members);
  } catch (error) {
    console.error('Error searching members:', error);
    res.status(500).json({ message: 'Error searching members', error: error.message });
  }
});

/**
 * POST /api/search/loans
 * Search loans by member name, member ID, or loan ID
 */
router.post('/loans', searchTracker('loans'), async (req, res) => {
  try {
    const { search, status, limit = 20 } = req.body;
    
    if (!search || search.trim().length === 0) {
      return res.json([]);
    }

    const searchTerm = search.trim();
    
    // First find members matching the search
    const members = await Member.find({
      $or: [
        { name: { $regex: searchTerm, $options: 'i' } },
        { member_id: { $regex: searchTerm, $options: 'i' } }
      ]
    }).select('_id').lean();
    
    const memberIds = members.map(m => m._id);
    
    const query = {
      $or: [
        { member_id: { $in: memberIds } },
        { loan_id: { $regex: searchTerm, $options: 'i' } }
      ]
    };
    
    if (status) {
      query.status = status;
    }

    const loans = await Loan.find(query)
      .populate('member_id', 'name phone member_id')
      .limit(parseInt(limit))
      .sort({ disbursement_date: -1 })
      .lean();

    res.json(loans);
  } catch (error) {
    console.error('Error searching loans:', error);
    res.status(500).json({ message: 'Error searching loans', error: error.message });
  }
});

/**
 * POST /api/search/transactions
 * Search transactions by member name, transaction type, or reference
 */
router.post('/transactions', searchTracker('transactions'), async (req, res) => {
  try {
    const { search, type, limit = 20 } = req.body;
    
    if (!search || search.trim().length === 0) {
      return res.json([]);
    }

    const searchTerm = search.trim();
    
    // Search in both Payment and Saving collections
    const members = await Member.find({
      $or: [
        { name: { $regex: searchTerm, $options: 'i' } },
        { member_id: { $regex: searchTerm, $options: 'i' } }
      ]
    }).select('_id').lean();
    
    const memberIds = members.map(m => m._id);
    
    const queries = [];
    
    // Search payments
    if (!type || type === 'payment' || type === 'loan_repayment') {
      const paymentQuery = { member_id: { $in: memberIds } };
      
      const payments = Payment.find(paymentQuery)
        .populate('member_id', 'name phone member_id')
        .populate('loan_id', 'loan_id amount')
        .limit(parseInt(limit))
        .sort({ transaction_date: -1 })
        .lean()
        .then(results => results.map(r => ({ ...r, type: 'payment' })));
      
      queries.push(payments);
    }
    
    // Search savings
    if (!type || type === 'saving' || type === 'deposit') {
      const savingQuery = { member_id: { $in: memberIds } };
      
      const savings = Saving.find(savingQuery)
        .populate('member_id', 'name phone member_id')
        .limit(parseInt(limit))
        .sort({ transaction_date: -1 })
        .lean()
        .then(results => results.map(r => ({ ...r, type: 'saving' })));
      
      queries.push(savings);
    }
    
    const results = await Promise.all(queries);
    const combined = results.flat().sort((a, b) => 
      new Date(b.transaction_date) - new Date(a.transaction_date)
    );
    
    res.json(combined.slice(0, parseInt(limit)));
  } catch (error) {
    console.error('Error searching transactions:', error);
    res.status(500).json({ message: 'Error searching transactions', error: error.message });
  }
});

/**
 * POST /api/search/savings
 * Search savings deposits by member
 */
router.post('/savings', searchTracker('savings'), async (req, res) => {
  try {
    const { search, limit = 20 } = req.body;
    
    if (!search || search.trim().length === 0) {
      return res.json([]);
    }

    const searchTerm = search.trim();
    
    const members = await Member.find({
      $or: [
        { name: { $regex: searchTerm, $options: 'i' } },
        { member_id: { $regex: searchTerm, $options: 'i' } }
      ]
    }).select('_id').lean();
    
    const memberIds = members.map(m => m._id);
    
    const savings = await Saving.find({ member_id: { $in: memberIds } })
      .populate('member_id', 'name phone member_id')
      .populate('cycle_number', 'cycle_number')
      .limit(parseInt(limit))
      .sort({ transaction_date: -1 })
      .lean();

    res.json(savings);
  } catch (error) {
    console.error('Error searching savings:', error);
    res.status(500).json({ message: 'Error searching savings', error: error.message });
  }
});

/**
 * POST /api/search/announcements
 * Search announcements by title or content
 */
router.post('/announcements', searchTracker('general'), async (req, res) => {
  try {
    const { search, limit = 20 } = req.body;
    
    if (!search || search.trim().length === 0) {
      return res.json([]);
    }

    const searchTerm = search.trim();
    
    const announcements = await Announcement.find({
      $or: [
        { title: { $regex: searchTerm, $options: 'i' } },
        { content: { $regex: searchTerm, $options: 'i' } }
      ]
    })
      .limit(parseInt(limit))
      .sort({ created_at: -1 })
      .lean();

    res.json(announcements);
  } catch (error) {
    console.error('Error searching announcements:', error);
    res.status(500).json({ message: 'Error searching announcements', error: error.message });
  }
});

/**
 * POST /api/search/all
 * Universal search across all entities
 */
router.post('/all', searchTracker('general'), async (req, res) => {
  try {
    const { search, limit = 10 } = req.body;
    
    if (!search || search.trim().length === 0) {
      return res.json({
        members: [],
        loans: [],
        transactions: [],
        announcements: []
      });
    }

    const searchTerm = search.trim();
    const searchLimit = parseInt(limit);
    
    // Search members
    const members = await Member.find({
      $or: [
        { name: { $regex: searchTerm, $options: 'i' } },
        { phone: { $regex: searchTerm, $options: 'i' } },
        { member_id: { $regex: searchTerm, $options: 'i' } }
      ],
      status: 'active'
    })
      .select('name phone member_id profile_picture')
      .limit(searchLimit)
      .lean();
    
    const memberIds = members.map(m => m._id);
    
    // Search loans
    const loans = await Loan.find({
      $or: [
        { member_id: { $in: memberIds } },
        { loan_id: { $regex: searchTerm, $options: 'i' } }
      ]
    })
      .populate('member_id', 'name phone member_id')
      .limit(searchLimit)
      .sort({ disbursement_date: -1 })
      .lean();
    
    // Search recent transactions (payments)
    const payments = await Payment.find({ 
      member_id: { $in: memberIds } 
    })
      .populate('member_id', 'name phone member_id')
      .limit(searchLimit)
      .sort({ transaction_date: -1 })
      .lean();
    
    // Search announcements
    const announcements = await Announcement.find({
      $or: [
        { title: { $regex: searchTerm, $options: 'i' } },
        { content: { $regex: searchTerm, $options: 'i' } }
      ]
    })
      .limit(searchLimit)
      .sort({ created_at: -1 })
      .lean();

    res.json({
      members,
      loans,
      transactions: payments,
      announcements,
      totalResults: members.length + loans.length + payments.length + announcements.length
    });
  } catch (error) {
    console.error('Error in universal search:', error);
    res.status(500).json({ message: 'Error performing search', error: error.message });
  }
});

export default router;
