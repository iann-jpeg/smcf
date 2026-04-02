import mongoose, { Schema, Document } from 'mongoose';

export interface ISACCOSettings extends Document {
  // Share settings
  shareValue: number;                    // KES per share (default 1000)
  minimumShares: number;                 // Minimum shares per member
  maximumShareholdingPercentage: number; // Max % per member
  
  // Allocation percentages
  dividendAllocationPercentage: number;        // % of profit for dividends
  reserveAllocationPercentage: number;         // % allocated to reserve
  operationsAllocationPercentage: number;      // % for operations
  
  // Loan multiplier
  loanMultiplierPerShare: number;        // Loan amount = shares × multiplier
  
  // Policy text (editable)
  policyText: {
    shareCapital?: string;
    dividendDistribution?: string;
    sharePurchase?: string;
    shareTransfer?: string;
    memberExit?: string;
    reserveFund?: string;
    constitution?: string;
  };
  
  // Audit
  lastModifiedBy: Schema.Types.ObjectId;
  lastModifiedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SACCOSettingsSchema = new Schema<ISACCOSettings>({
  shareValue: {
    type: Number,
    default: 1000,
    required: true,
    min: 1
  },
  minimumShares: {
    type: Number,
    default: 10,
    required: true,
    min: 1
  },
  maximumShareholdingPercentage: {
    type: Number,
    default: 30, // 30% max per member
    required: true,
    min: 0,
    max: 100
  },
  dividendAllocationPercentage: {
    type: Number,
    default: 50,
    required: true,
    min: 0,
    max: 100
  },
  reserveAllocationPercentage: {
    type: Number,
    default: 25,
    required: true,
    min: 0,
    max: 100
  },
  operationsAllocationPercentage: {
    type: Number,
    default: 25,
    required: true,
    min: 0,
    max: 100
  },
  loanMultiplierPerShare: {
    type: Number,
    default: 0.5, // Each share = KES 500 loan capacity
    required: true
  },
  policyText: {
    shareCapital: String,
    dividendDistribution: String,
    sharePurchase: String,
    shareTransfer: String,
    memberExit: String,
    reserveFund: String,
    constitution: String
  },
  lastModifiedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastModifiedAt: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model<ISACCOSettings>('SACCOSettings', SACCOSettingsSchema);
