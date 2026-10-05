import mongoose, { Schema, Document } from 'mongoose';

export interface ITransaction extends Document {
  transactionRef: string;
  memberId: mongoose.Types.ObjectId;
  type: 'deposit' | 'wallet_deposit' | 'tenx_contribution' | 'withdrawal' | 'loan_disbursement' | 'loan_repayment' | 'share_purchase' | 'share_transfer' | 'dividend' | 'savings_interest' | 'registration_fee';
  amount: number;
  grossAmount?: number;
  feeAmount?: number;
  netAmount?: number;
  feeType?: 'unified_transaction_fee' | 'none';
  description: string | null;
  status: 'pending' | 'completed' | 'failed' | 'reversed' | 'declined';
  providerStatus?: 'pending' | 'success' | 'failed' | 'unknown';
  financialPostingStatus?: 'pending' | 'completed' | 'failed';
  reconciliationStatus?: 'none' | 'reconciled' | 'requires_reconciliation';
  reconciliationAttempts?: number;
  lastReconciliationAt?: Date;
  processedAt: Date;
  createdBy: mongoose.Types.ObjectId | null;
  createdAt: Date;
  // STK push tracking
  checkoutRequestId?: string;
  mpesaRef?: string;
  paymentGateway?: string;
  providerOrderTrackingId?: string;
  providerMerchantReference?: string;
  paymentPurpose?: 'savings' | 'wallet' | 'cycle' | 'tenx' | 'loan_repayment' | 'registration_fee';
  subscriptionId?: mongoose.Types.ObjectId;
  cycleNumber?: number;
  loanId?: string;
  depositProcessed?: boolean;
}

const TransactionSchema = new Schema<ITransaction>({
  transactionRef: { 
    type: String, 
    required: true, 
    unique: true 
  },
  memberId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Member',
    required: true 
  },
  type: { 
    type: String, 
    enum: ['deposit', 'wallet_deposit', 'tenx_contribution', 'withdrawal', 'loan_disbursement', 'loan_repayment', 'share_purchase', 'share_transfer', 'dividend', 'savings_interest', 'registration_fee'],
    required: true 
  },
  amount: { 
    type: Number, 
    required: true 
  },
  grossAmount: { type: Number, default: null },
  feeAmount: { type: Number, default: 0 },
  netAmount: { type: Number, default: null },
  feeType: { type: String, enum: ['unified_transaction_fee', 'none'], default: 'none' },
  description: { 
    type: String, 
    default: null 
  },
  status: { 
    type: String, 
    enum: ['pending', 'completed', 'failed', 'reversed', 'declined'],
    default: 'pending' 
  },
  providerStatus: { type: String, enum: ['pending', 'success', 'failed', 'unknown'], default: 'pending' },
  financialPostingStatus: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  reconciliationStatus: { type: String, enum: ['none', 'reconciled', 'requires_reconciliation'], default: 'none' },
  reconciliationAttempts: { type: Number, default: 0 },
  lastReconciliationAt: { type: Date, default: null },
  processedAt: { 
    type: Date, 
    default: Date.now 
  },
  createdBy: { 
    type: Schema.Types.ObjectId, 
    ref: 'User',
    default: null 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  checkoutRequestId: { type: String, default: null },
  mpesaRef: { type: String, default: null },
  paymentGateway: { type: String, default: null },
  providerOrderTrackingId: { type: String, default: null, sparse: true },
  providerMerchantReference: { type: String, default: null, sparse: true },
  paymentPurpose: { type: String, enum: ['savings', 'wallet', 'cycle', 'tenx', 'loan_repayment', 'registration_fee'], default: null },
  subscriptionId: { type: Schema.Types.ObjectId, ref: 'CardSubscription', default: null },
  cycleNumber: { type: Number, default: undefined, sparse: true },
  loanId: { type: String, default: null },
  depositProcessed: { type: Boolean, default: false },
});

// Indexes (transactionRef skipped — unique: true already creates it)
TransactionSchema.index({ memberId: 1 });
TransactionSchema.index({ type: 1 });
TransactionSchema.index({ processedAt: -1 });
TransactionSchema.index({ status: 1 });
TransactionSchema.index({ providerStatus: 1, financialPostingStatus: 1 });
TransactionSchema.index({ checkoutRequestId: 1 });
TransactionSchema.index({ mpesaRef: 1 }, { sparse: true });
TransactionSchema.index({ providerOrderTrackingId: 1 }, { sparse: true });
TransactionSchema.index({ providerMerchantReference: 1 }, { sparse: true });
TransactionSchema.index({ memberId: 1, cycleNumber: 1, processedAt: -1 });

export default mongoose.model<ITransaction>('Transaction', TransactionSchema);
