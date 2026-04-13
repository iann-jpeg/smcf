import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Loan from '../models/Loan';
import LoanApproval from '../models/LoanApproval';
import LoanGuarantor from '../models/LoanGuarantor';
import RepaymentRecord from '../models/RepaymentRecord';
import Member from '../models/Member';
import Shareholder from '../models/Shareholder';
import Transaction from '../models/Transaction';

dotenv.config();

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

const LOAN_TRANSACTION_TYPES = ['loan_disbursement', 'loan_repayment'] as const;

async function resetLoans() {
  const mongoUri = requiredEnv('MONGODB_URI');
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const [
    loanCount,
    approvalCount,
    guarantorCount,
    repaymentCount,
    loanTransactionCount,
    memberLoanCount,
    shareholderLoanCount,
  ] = await Promise.all([
    Loan.countDocuments(),
    LoanApproval.countDocuments(),
    LoanGuarantor.countDocuments(),
    RepaymentRecord.countDocuments(),
    Transaction.countDocuments({ type: { $in: LOAN_TRANSACTION_TYPES } }),
    Member.countDocuments({ loanBalance: { $gt: 0 } }),
    Shareholder.countDocuments({ loanBalance: { $gt: 0 } }),
  ]);

  console.log('Current loan-related counts:');
  console.log(`- loans: ${loanCount}`);
  console.log(`- loan approvals: ${approvalCount}`);
  console.log(`- loan guarantors: ${guarantorCount}`);
  console.log(`- repayment records: ${repaymentCount}`);
  console.log(`- loan transactions: ${loanTransactionCount}`);
  console.log(`- members with loan balance: ${memberLoanCount}`);
  console.log(`- shareholders with loan balance: ${shareholderLoanCount}`);

  const [
    loanDelete,
    approvalDelete,
    guarantorDelete,
    repaymentDelete,
    loanTxnDelete,
    memberUpdate,
    shareholderUpdate,
  ] = await Promise.all([
    Loan.deleteMany({}),
    LoanApproval.deleteMany({}),
    LoanGuarantor.deleteMany({}),
    RepaymentRecord.deleteMany({}),
    Transaction.deleteMany({ type: { $in: LOAN_TRANSACTION_TYPES } }),
    Member.updateMany({}, { $set: { loanBalance: 0 } }),
    Shareholder.updateMany({}, { $set: { loanBalance: 0 } }),
  ]);

  const memberModified = 'modifiedCount' in memberUpdate ? memberUpdate.modifiedCount : 0;
  const shareholderModified = 'modifiedCount' in shareholderUpdate ? shareholderUpdate.modifiedCount : 0;

  console.log('Reset results:');
  console.log(`- loans deleted: ${loanDelete.deletedCount ?? 0}`);
  console.log(`- loan approvals deleted: ${approvalDelete.deletedCount ?? 0}`);
  console.log(`- loan guarantors deleted: ${guarantorDelete.deletedCount ?? 0}`);
  console.log(`- repayment records deleted: ${repaymentDelete.deletedCount ?? 0}`);
  console.log(`- loan transactions deleted: ${loanTxnDelete.deletedCount ?? 0}`);
  console.log(`- members updated: ${memberModified}`);
  console.log(`- shareholders updated: ${shareholderModified}`);
}

resetLoans()
  .then(async () => {
    await mongoose.disconnect();
    console.log('Done. MongoDB connection closed.');
  })
  .catch(async (error) => {
    console.error('Loan reset failed:', error);
    await mongoose.disconnect().catch(() => undefined);
    process.exitCode = 1;
  });
