import mongoose, { Schema, Document } from 'mongoose';

export type TransactionType = 'purchase' | 'transfer_in' | 'transfer_out' | 'adjustment' | 'exit_settlement';

export interface IShareTransaction extends Document {
  shareholderId: Schema.Types.ObjectId;
  memberId: string;
  
  // Transaction Details
  transactionType: TransactionType;
  numberOfShares: number;
  shareValue: number;
  totalValue: number;
  
  // Payment Info
  paymentMethod: string;                 // e.g., "M-Pesa", "Bank Transfer", "Cash"
  referenceNumber: string;
  
  // Related Info
  relatedMemberId?: string;              // For transfers
  relatedShareholderId?: Schema.Types.ObjectId;
  
  // Status & Approval
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: Schema.Types.ObjectId;
  approvedAt?: Date;
  rejectionReason?: string;
  
  // Metadata
  notes?: string;
  
  // Audit - Immutable
  createdBy: Schema.Types.ObjectId;
  createdAt: Date;
  
  // Transaction ID (immutable reference)
  transactionId: string;                 // Auto-generated: TXN-YYYYMMDD-XXXXX
}

const ShareTransactionSchema = new Schema<IShareTransaction>({
  shareholderId: {
    type: Schema.Types.ObjectId,
    ref: 'Shareholder',
    required: true,
    index: true
  },
  memberId: {
    type: String,
    required: true,
    index: true
  },
  transactionType: {
    type: String,
    enum: ['purchase', 'transfer_in', 'transfer_out', 'adjustment', 'exit_settlement'],
    required: true
  },
  numberOfShares: {
    type: Number,
    required: true,
    min: 0
  },
  shareValue: {
    type: Number,
    required: true,
    min: 0
  },
  totalValue: {
    type: Number,
    required: true,
    min: 0
  },
  paymentMethod: {
    type: String,
    required: true
  },
  referenceNumber: {
    type: String,
    required: true,
    unique: true
  },
  relatedMemberId: String,
  relatedShareholderId: {
    type: Schema.Types.ObjectId,
    ref: 'Shareholder'
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  approvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  rejectionReason: String,
  notes: String,
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true,
    index: true
  },
  transactionId: {
    type: String,
    unique: true,
    immutable: true,
    index: true
  }
}, { 
  timestamps: false  // Only use createdAt, no updatedAt for immutability
});

// Pre-save middleware to generate transaction ID
ShareTransactionSchema.pre('save', async function(next) {
  if (!this.transactionId) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await mongoose.model('ShareTransaction').countDocuments({ createdAt: { $gte: new Date().setHours(0, 0, 0, 0) } });
    this.transactionId = `TXN-${date}-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

// Indexes
ShareTransactionSchema.index({ status: 1 });
ShareTransactionSchema.index({ transactionType: 1 });
ShareTransactionSchema.index({ createdAt: -1 });
ShareTransactionSchema.index({ memberId: 1, createdAt: -1 });

export default mongoose.model<IShareTransaction>('ShareTransaction', ShareTransactionSchema);
