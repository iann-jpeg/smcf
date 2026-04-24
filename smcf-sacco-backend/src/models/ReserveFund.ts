import mongoose, { Schema, Document } from 'mongoose';

export interface IReserveFund extends Document {
  // Balance Tracking
  openingBalance: number;
  currentBalance: number;
  
  // Configuration
  targetAmount?: number;                 // Future target for reserve
  minimumBalance?: number;               // Minimum to maintain
  
  // Audit
  createdAt: Date;
  updatedAt: Date;
}

const ReserveFundSchema = new Schema<IReserveFund>({
  openingBalance: {
    type: Number,
    default: 0,
    min: 0
  },
  currentBalance: {
    type: Number,
    default: 0,
    min: 0
  },
  targetAmount: Number,
  minimumBalance: Number,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

export default mongoose.model<IReserveFund>('ReserveFund', ReserveFundSchema);

// Reserve Fund Transaction Model
export interface IReserveFundTransaction extends Document {
  transactionType: 'inflow' | 'outflow';
  source?: string;                       // e.g., "Loan penalties", "Profit share", "Service charges"
  usageCategory?: string;                // e.g., "Emergency fund", "Member assistance", "Operational needs"
  
  // Amount
  amount: number;
  
  // Description
  description: string;
  reference: string;                     // Transaction reference
  
  // Status (for outflows)
  status: 'pending' | 'approved' | 'completed' | 'rejected';
  
  // Approvals (for critical withdrawals)
  requiredApprovals: number;
  approvals: Array<{
    approvedBy: Schema.Types.ObjectId;
    approvedAt: Date;
  }>;
  
  // Balance snapshot
  balanceAfter: number;
  
  // Audit
  initiatedBy: Schema.Types.ObjectId;
  approvedBy?: Schema.Types.ObjectId;
  approvedAt?: Date;
  completedAt?: Date;
  rejectionReason?: string;
  
  createdAt: Date;
  updatedAt: Date;
  
  // Reference ID
  transactionId: string;                 // e.g., RFT-YYYYMMDD-XXXXX
}

const ReserveFundTransactionSchema = new Schema<IReserveFundTransaction>({
  transactionType: {
    type: String,
    enum: ['inflow', 'outflow'],
    required: true,
    index: true
  },
  source: String,
  usageCategory: String,
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    required: true
  },
  reference: {
    type: String,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'completed', 'rejected'],
    default: 'pending',
    index: true
  },
  requiredApprovals: {
    type: Number,
    default: 1
  },
  approvals: [{
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: Date
  }],
  balanceAfter: {
    type: Number,
    required: true
  },
  initiatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  completedAt: Date,
  rejectionReason: String,
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  transactionId: {
    type: String,
    unique: true,
    index: true
  }
}, { timestamps: true });

// Indexes
ReserveFundTransactionSchema.index({ status: 1 });
ReserveFundTransactionSchema.index({ createdAt: -1 });
ReserveFundTransactionSchema.index({ transactionType: 1, createdAt: -1 });

export const ReserveFundTransactionModel = mongoose.model<IReserveFundTransaction>('ReserveFundTransaction', ReserveFundTransactionSchema);
