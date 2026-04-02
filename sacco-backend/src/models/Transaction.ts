import mongoose, { Schema, Document } from 'mongoose';

export interface ITransaction extends Document {
  transactionRef: string;
  memberId: mongoose.Types.ObjectId;
  type: 'deposit' | 'withdrawal' | 'loan_disbursement' | 'loan_repayment' | 'share_purchase' | 'share_transfer' | 'dividend';
  amount: number;
  description: string | null;
  status: 'pending' | 'completed' | 'failed' | 'reversed' | 'declined';
  processedAt: Date;
  createdBy: mongoose.Types.ObjectId | null;
  createdAt: Date;
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
    enum: ['deposit', 'withdrawal', 'loan_disbursement', 'loan_repayment', 'share_purchase', 'share_transfer', 'dividend'],
    required: true 
  },
  amount: { 
    type: Number, 
    required: true 
  },
  description: { 
    type: String, 
    default: null 
  },
  status: { 
    type: String, 
    enum: ['pending', 'completed', 'failed', 'reversed', 'declined'],
    default: 'pending' 
  },
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
  }
});

// Indexes (transactionRef skipped — unique: true already creates it)
TransactionSchema.index({ memberId: 1 });
TransactionSchema.index({ type: 1 });
TransactionSchema.index({ processedAt: -1 });
TransactionSchema.index({ status: 1 });

export default mongoose.model<ITransaction>('Transaction', TransactionSchema);
