/**
 * Backfill Analytics Data
 * 
 * This script creates historical analytics records from existing:
 * - Payment transactions
 * - Member activities
 * - Loan activities
 * - Savings transactions
 * - Reserve account transactions
 * 
 * Run with: node scripts/backfill-analytics.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

import Payment from '../models/Payment.js';
import Member from '../models/Member.js';
import Loan from '../models/Loan.js';
import Saving from '../models/Saving.js';
import ActivityLog from '../models/ActivityLog.js';
import ReserveTransaction from '../models/ReserveTransaction.js';
import GroupReserveAccount from '../models/GroupReserveAccount.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/smcf';

async function backfillAnalytics() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // 1. Backfill payment activities
    console.log('📊 Backfilling payment activities...');
    const payments = await Payment.find({ status: 'completed' }).sort({ createdAt: 1 });
    let paymentCount = 0;

    for (const payment of payments) {
      const existingLog = await ActivityLog.findOne({
        userId: payment.member_id,
        'metadata.paymentId': payment._id
      });

      if (!existingLog) {
        await ActivityLog.create({
          userId: payment.member_id,
          userModel: 'Member',
          activityType: 'deposit',
          description: `${payment.type.charAt(0).toUpperCase() + payment.type.slice(1)} payment of KSH ${payment.amount.toLocaleString()}`,
          amount: payment.amount,
          ipAddress: '127.0.0.1',
          metadata: {
            paymentId: payment._id,
            paymentMethod: payment.payment_method,
            mpesaTransactionId: payment.mpesa_transaction_id,
            paymentType: payment.type,
            backfilled: true
          },
          createdAt: payment.createdAt
        });
        paymentCount++;
      }
    }
    console.log(`✅ Created ${paymentCount} payment activity logs\n`);

    // 2. Backfill loan activities
    console.log('📊 Backfilling loan activities...');
    const loans = await Loan.find().sort({ createdAt: 1 });
    let loanCount = 0;

    for (const loan of loans) {
      const existingLog = await ActivityLog.findOne({
        userId: loan.member_id,
        'metadata.loanId': loan._id,
        activityType: 'loan_application'
      });

      if (!existingLog) {
        await ActivityLog.create({
          userId: loan.member_id,
          userModel: 'Member',
          activityType: 'loan_application',
          description: `Loan request for KSH ${loan.amount.toLocaleString()}`,
          amount: loan.amount,
          ipAddress: '127.0.0.1',
          metadata: {
            loanId: loan._id,
            purpose: loan.purpose,
            status: loan.status,
            backfilled: true
          },
          createdAt: loan.createdAt
        });
        loanCount++;
      }

      // Backfill repayment activities
      if (loan.repayments && loan.repayments.length > 0) {
        for (const repayment of loan.repayments) {
          const repaymentLog = await ActivityLog.findOne({
            userId: loan.member_id,
            activityType: 'loan_repayment',
            'metadata.repaymentDate': repayment.date
          });

          if (!repaymentLog) {
            await ActivityLog.create({
              userId: loan.member_id,
              userModel: 'Member',
              activityType: 'loan_repayment',
              description: `Loan repayment of KSH ${repayment.amount.toLocaleString()}`,
              amount: repayment.amount,
              ipAddress: '127.0.0.1',
              metadata: {
                loanId: loan._id,
                repaymentDate: repayment.date,
                backfilled: true
              },
              createdAt: repayment.date
            });
            loanCount++;
          }
        }
      }
    }
    console.log(`✅ Created ${loanCount} loan activity logs\n`);

    // 3. Backfill savings activities
    console.log('📊 Backfilling savings activities...');
    const savings = await Saving.find().sort({ deposit_date: 1 });
    let savingsCount = 0;

    for (const saving of savings) {
      const existingLog = await ActivityLog.findOne({
        userId: saving.member_id,
        'metadata.savingId': saving._id,
        activityType: 'deposit'
      });

      if (!existingLog) {
        await ActivityLog.create({
          userId: saving.member_id,
          userModel: 'Member',
          activityType: 'deposit',
          description: `Savings deposit of KSH ${saving.amount.toLocaleString()}`,
          amount: saving.amount,
          ipAddress: '127.0.0.1',
          metadata: {
            savingId: saving._id,
            status: saving.status,
            lockPeriod: saving.lock_period_months,
            savingsType: 'deposit',
            backfilled: true
          },
          createdAt: saving.deposit_date
        });
        savingsCount++;
      }

      // Backfill withdrawal activities
      if (saving.status === 'withdrawn' && saving.withdrawal_date) {
        const withdrawalLog = await ActivityLog.findOne({
          userId: saving.member_id,
          'metadata.savingId': saving._id,
          activityType: 'withdrawal'
        });

        if (!withdrawalLog) {
          await ActivityLog.create({
            userId: saving.member_id,
            userModel: 'Member',
            activityType: 'withdrawal',
            description: `Savings withdrawal of KSH ${saving.amount.toLocaleString()}`,
            amount: saving.amount,
            ipAddress: '127.0.0.1',
            metadata: {
              savingId: saving._id,
              penalty: saving.penalty_amount || 0,
              savingsType: 'withdrawal',
              backfilled: true
            },
            createdAt: saving.withdrawal_date
          });
          savingsCount++;
        }
      }
    }
    console.log(`✅ Created ${savingsCount} savings activity logs\n`);

    // 4. Backfill reserve account transactions
    console.log('📊 Backfilling reserve account activities...');
    const reserveTransactions = await ReserveTransaction.find().sort({ createdAt: 1 });
    let reserveCount = 0;

    for (const transaction of reserveTransactions) {
      // Skip if no initiatedBy (required field)
      if (!transaction.initiatedBy) {
        console.log(`⚠️  Skipping reserve transaction ${transaction._id} - no initiatedBy`);
        continue;
      }

      const existingLog = await ActivityLog.findOne({
        userId: transaction.initiatedBy,
        'metadata.reserveTransactionId': transaction._id
      });

      if (!existingLog) {
        await ActivityLog.create({
          userId: transaction.initiatedBy,
          userModel: 'Admin',
          activityType: transaction.type === 'deposit' ? 'deposit' : 'withdrawal',
          description: `Reserve ${transaction.type} of KSH ${transaction.amount.toLocaleString()} - ${transaction.description}`,
          amount: transaction.amount,
          ipAddress: '127.0.0.1',
          metadata: {
            reserveTransactionId: transaction._id,
            type: transaction.type,
            category: transaction.category,
            reserveTransaction: true,
            backfilled: true
          },
          createdAt: transaction.createdAt
        });
        reserveCount++;
      }
    }
    console.log(`✅ Created ${reserveCount} reserve activity logs\n`);

    // 5. Summary statistics
    console.log('📈 Analytics Summary:');
    const totalActivities = await ActivityLog.countDocuments();
    const backfilledActivities = await ActivityLog.countDocuments({ 'metadata.backfilled': true });
    const dateRange = await ActivityLog.aggregate([
      {
        $group: {
          _id: null,
          earliest: { $min: '$createdAt' },
          latest: { $max: '$createdAt' }
        }
      }
    ]);

    console.log(`   Total Activities: ${totalActivities}`);
    console.log(`   Backfilled: ${backfilledActivities}`);
    if (dateRange.length > 0) {
      console.log(`   Date Range: ${new Date(dateRange[0].earliest).toLocaleDateString()} to ${new Date(dateRange[0].latest).toLocaleDateString()}`);
    }

    // 6. Activity type breakdown
    const activityBreakdown = await ActivityLog.aggregate([
      {
        $group: {
          _id: '$activityType',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    console.log('\n📊 Activity Breakdown:');
    activityBreakdown.forEach(item => {
      console.log(`   ${item._id}: ${item.count}`);
    });

    // 7. Ensure group reserve account exists
    console.log('\n💰 Checking group reserve account...');
    let reserveAccount = await GroupReserveAccount.findOne();
    
    if (!reserveAccount) {
      // Calculate initial balance from all reserve transactions
      const initialBalance = await ReserveTransaction.aggregate([
        {
          $group: {
            _id: null,
            total: {
              $sum: {
                $cond: [
                  { $eq: ['$type', 'deposit'] },
                  '$amount',
                  { $multiply: ['$amount', -1] }
                ]
              }
            }
          }
        }
      ]);

      const balance = initialBalance.length > 0 && initialBalance[0].total != null ? initialBalance[0].total : 0;

      reserveAccount = await GroupReserveAccount.create({
        balance,
        lastUpdated: new Date()
      });

      console.log(`✅ Created reserve account with balance: KSH ${Number(balance).toLocaleString()}`);
    } else {
      console.log(`✅ Reserve account exists with balance: KSH ${Number(reserveAccount.balance).toLocaleString()}`);
    }

    console.log('\n✅ Analytics backfill completed successfully!');

  } catch (error) {
    console.error('❌ Error during backfill:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 MongoDB connection closed');
  }
}

// Run the script
backfillAnalytics()
  .then(() => {
    console.log('\n✨ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
