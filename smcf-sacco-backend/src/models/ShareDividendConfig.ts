import mongoose, { Schema, Document } from 'mongoose';
import { DividendCalculationMode, DividendEligibilityRule } from './ShareDividendDistribution';

export interface IShareDividendConfig extends Document {
  distributionPeriod: string;
  totalProfitAvailable: number;
  dividendRate: number | null;
  totalDividendPool: number | null;
  calculationMode: DividendCalculationMode;
  eligibilityRule: DividendEligibilityRule;
  configuredBy: Schema.Types.ObjectId;
  configuredAt: Date;
  notes: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ShareDividendConfigSchema = new Schema<IShareDividendConfig>(
  {
    distributionPeriod: { type: String, required: true, index: true },
    totalProfitAvailable: { type: Number, required: true, min: 0 },
    dividendRate: { type: Number, default: null, min: 0 },
    totalDividendPool: { type: Number, default: null, min: 0 },
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
    configuredBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    configuredAt: { type: Date, default: Date.now },
    notes: { type: String, default: null },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

ShareDividendConfigSchema.index({ configuredAt: -1 });

export default mongoose.model<IShareDividendConfig>('ShareDividendConfig', ShareDividendConfigSchema);
