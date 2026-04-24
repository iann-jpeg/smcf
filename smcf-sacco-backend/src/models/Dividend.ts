import mongoose, { Schema, Document } from 'mongoose';

export interface IDividend extends Document {
  // Profit Period
  profitPeriodStart: Date;
  profitPeriodEnd: Date;
  
  // Financial Info
  totalProfit: number;
  
  // Allocations (auto-calculated)
  shareholderPoolPercentage: number;    // % allocated to shareholders
  shareholderPoolAmount: number;         // Calculated: totalProfit * shareholderPoolPercentage
  reserveAllocation: number;
  operationsAllocation: number;
  
  // Total shares info at time of dividend
  totalSharesIssued: number;
  
  // Status
  status: 'draft' | 'approved' | 'distributed' | 'closed';
  approvedBy?: Schema.Types.ObjectId;
  approvedAt?: Date;
  distributedAt?: Date;
  
  // Dividend Payment Method
  paymentMethod: string;                 // e.g., "Bank Transfer", "Mobile Money"
  paymentDetails?: string;
  
  // Notes
  notes?: string;
  
  // Audit
  createdBy: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  
  // Reference ID
  dividendId: string;                    // e.g., DIV-2024-Q1
}

const DividendSchema = new Schema<IDividend>({
  profitPeriodStart: {
    type: Date,
    required: true,
    index: true
  },
  profitPeriodEnd: {
    type: Date,
    required: true,
    index: true
  },
  totalProfit: {
    type: Number,
    required: true,
    min: 0
  },
  shareholderPoolPercentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  shareholderPoolAmount: {
    type: Number,
    required: true,
    min: 0
  },
  reserveAllocation: {
    type: Number,
    required: true,
    min: 0
  },
  operationsAllocation: {
    type: Number,
    required: true,
    min: 0
  },
  totalSharesIssued: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['draft', 'approved', 'distributed', 'closed'],
    default: 'draft'
  },
  approvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  distributedAt: Date,
  paymentMethod: String,
  paymentDetails: String,
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
    default: Date.now
  },
  dividendId: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  }
}, { timestamps: true });

// Indexes
DividendSchema.index({ status: 1 });
DividendSchema.index({ createdAt: -1 });

export default mongoose.model<IDividend>('Dividend', DividendSchema);

// Dividend Statement Model
export interface IDividendStatement extends Document {
  dividendId: Schema.Types.ObjectId;
  shareholderId: Schema.Types.ObjectId;
  memberId: string;
  shareholderName: string;
  
  // Calculation Details
  sharesOwned: number;
  sharePercentage: number;               // shares / total shares * 100
  dividendAmount: number;                 // (shares / totalShares) * pool
  
  // Payment Status
  paymentStatus: 'pending' | 'paid' | 'failed';
  paymentDate?: Date;
  paymentReference?: string;
  
  // Document Reference
  statementPDF?: string;                 // File path or base64
  
  // Audit
  createdAt: Date;
  generatedBy: Schema.Types.ObjectId;
}

const DividendStatementSchema = new Schema<IDividendStatement>({
  dividendId: {
    type: Schema.Types.ObjectId,
    ref: 'Dividend',
    required: true,
    index: true
  },
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
  shareholderName: {
    type: String,
    required: true
  },
  sharesOwned: {
    type: Number,
    required: true,
    min: 0
  },
  sharePercentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  dividendAmount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending'
  },
  paymentDate: Date,
  paymentReference: String,
  statementPDF: String,
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  generatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
});

// Indexes
DividendStatementSchema.index({ dividendId: 1, shareholderId: 1 });
DividendStatementSchema.index({ paymentStatus: 1 });

export const DividendStatementModel = mongoose.model<IDividendStatement>('DividendStatement', DividendStatementSchema);
