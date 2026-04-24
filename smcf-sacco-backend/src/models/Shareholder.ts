import mongoose, { Schema, Document } from 'mongoose';

export interface IShareholder extends Document {
  // Basic Info
  memberId: string;                      // Link to Member
  userId: Schema.Types.ObjectId | null;  // Link to User account
  fullName: string;
  nationalId: string;
  phoneNumber: string;
  email?: string;
  dateJoined: Date;
  
  // Shareholding Info
  sharesOwned: number;
  totalShareValue: number;               // shares * shareValue
  
  // Linked Balances
  savingsBalance: number;
  loanBalance: number;
  
  // Dividend Info
  totalDividendEarned: number;
  lastDividendAmount?: number;
  lastDividendDate?: Date;
  
  // Status
  status: 'Active' | 'Pending' | 'Suspended' | 'Exited';
  statusChangedAt: Date;
  statusChangedBy: Schema.Types.ObjectId;
  
  // Exit Info (if exited)
  exitDate?: Date;
  exitReason?: string;
  exitSettlementAmount?: number;
  exitSettledBy?: Schema.Types.ObjectId;
  
  // KYC Documents
  kycVerified: boolean;
  kycDocuments?: {
    nationalIdCopy: string | null;     // base64
    passportPhoto: string | null;      // base64
    shareholdingCertificate: string | null;
  };
  
  // Notes
  notes?: string;
  
  // Audit
  createdBy: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ShareholderSchema = new Schema<IShareholder>({
  memberId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  fullName: {
    type: String,
    required: true,
    index: true
  },
  nationalId: {
    type: String,
    required: true,
    unique: true
  },
  phoneNumber: {
    type: String,
    required: true
  },
  email: {
    type: String,
    sparse: true
  },
  dateJoined: {
    type: Date,
    default: Date.now,
    required: true
  },
  sharesOwned: {
    type: Number,
    default: 0,
    min: 0
  },
  totalShareValue: {
    type: Number,
    default: 0,
    min: 0
  },
  savingsBalance: {
    type: Number,
    default: 0,
    min: 0
  },
  loanBalance: {
    type: Number,
    default: 0,
    min: 0
  },
  totalDividendEarned: {
    type: Number,
    default: 0,
    min: 0
  },
  lastDividendAmount: Number,
  lastDividendDate: Date,
  status: {
    type: String,
    enum: ['Active', 'Pending', 'Suspended', 'Exited'],
    default: 'Pending'
  },
  statusChangedAt: {
    type: Date,
    default: Date.now
  },
  statusChangedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  exitDate: Date,
  exitReason: String,
  exitSettlementAmount: Number,
  exitSettledBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  kycVerified: {
    type: Boolean,
    default: false
  },
  kycDocuments: {
    nationalIdCopy: { type: String, default: null },
    passportPhoto: { type: String, default: null },
    shareholdingCertificate: { type: String, default: null }
  },
  notes: String,
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, { timestamps: true });

// Indexes for common queries
ShareholderSchema.index({ status: 1 });
ShareholderSchema.index({ dateJoined: -1 });
ShareholderSchema.index({ sharesOwned: -1 });

export default mongoose.model<IShareholder>('Shareholder', ShareholderSchema);
