import mongoose, { Schema, Document } from 'mongoose';

export type DividendCalculationMode = 'percentage_based' | 'pool_based';
export type DividendEligibilityRule =
  | 'all_with_shares'
  | 'active_members'
  | 'minimum_share_capital'
  | 'no_defaulted_loans';

export interface IShareDividendDistribution extends Document {
  distributionPeriod: string;
  totalProfitAvailable: number;
  dividendRate: number | null;
  totalDividendPool: number;
  calculationMode: DividendCalculationMode;
  eligibilityRule: DividendEligibilityRule;
  totalMembersEligible: number;
  totalSharesAtDistribution: number;
  totalDividendsDistributed: number;
  status: 'completed' | 'reversed';
  configuredBy: Schema.Types.ObjectId;
  approvedBy: Schema.Types.ObjectId;
  configuredAt: Date;
  approvedAt: Date;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const ShareDividendDistributionSchema = new Schema<IShareDividendDistribution>(
  {
    distributionPeriod: { type: String, required: true, unique: true, index: true },
    totalProfitAvailable: { type: Number, required: true, min: 0 },
    dividendRate: { type: Number, default: null, min: 0 },
    totalDividendPool: { type: Number, required: true, min: 0 },
    calculationMode: {
      type: String,
      enum: ['percentage_based', 'pool_based'],
      required: true,
    },
    eligibilityRule: {
      type: String,
      enum: ['all_with_shares', 'active_members', 'minimum_share_capital', 'no_defaulted_loans'],
      required: true,
      default: 'all_with_shares',
    },
    totalMembersEligible: { type: Number, required: true, min: 0 },
    totalSharesAtDistribution: { type: Number, required: true, min: 0 },
    totalDividendsDistributed: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['completed', 'reversed'], default: 'completed', index: true },
    configuredBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    configuredAt: { type: Date, default: Date.now },
    approvedAt: { type: Date, default: Date.now },
    notes: { type: String, default: null },
  },
  {
    timestamps: true,
  }
);

ShareDividendDistributionSchema.index({ approvedAt: -1 });

export default mongoose.model<IShareDividendDistribution>(
  'ShareDividendDistribution',
  ShareDividendDistributionSchema
);

export interface IShareDividendRecord extends Document {
  distributionId: Schema.Types.ObjectId;
  memberId: Schema.Types.ObjectId;
  memberName: string;
  memberCode: string;
  sharesHeldAtDistribution: number;
  shareCapitalValueAtDistribution: number;
  dividendAmount: number;
  calculationType: DividendCalculationMode;
  distributionPeriod: string;
  approvedBy: Schema.Types.ObjectId;
  approvedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ShareDividendRecordSchema = new Schema<IShareDividendRecord>(
  {
    distributionId: { type: Schema.Types.ObjectId, ref: 'ShareDividendDistribution', required: true, index: true },
    memberId: { type: Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
    memberName: { type: String, required: true },
    memberCode: { type: String, required: true },
    sharesHeldAtDistribution: { type: Number, required: true, min: 0 },
    shareCapitalValueAtDistribution: { type: Number, required: true, min: 0 },
    dividendAmount: { type: Number, required: true, min: 0 },
    calculationType: { type: String, enum: ['percentage_based', 'pool_based'], required: true },
    distributionPeriod: { type: String, required: true, index: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    approvedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

ShareDividendRecordSchema.index({ memberId: 1, approvedAt: -1 });

export const ShareDividendRecordModel = mongoose.model<IShareDividendRecord>(
  'ShareDividendRecord',
  ShareDividendRecordSchema
);
