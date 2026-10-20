import mongoose, { Document, Model } from 'mongoose';

export interface ISystemConfig extends Document {
  interestRate: number;
  interestModel: 'reducing' | 'flat';
  processingFee: number;
  penaltyRate: number;
  autoApproveLimit: number;
  committeeThreshold: number;
  maxGuaranteeMultiplier: number;
  minGuarantors: number;
  minLiquidityRatio: number;
  tenXMinShares: number;
  tenXMinSavings: number;
  tenXSharesApproved: boolean;
  tenXSavingsApproved: boolean;
  tenXMonthlyContribution: number;
  tenXAssetPlan: string;
  adminBootstrapConsumed: boolean;
}

interface ISystemConfigModel extends Model<ISystemConfig> {
  getConfig(): Promise<ISystemConfig>;
}

const SystemConfigSchema = new mongoose.Schema<ISystemConfig>(
  {
    interestRate:           { type: Number, default: 12 },
    interestModel:          { type: String, default: 'reducing', enum: ['reducing', 'flat'] },
    processingFee:          { type: Number, default: 1 },
    penaltyRate:            { type: Number, default: 5 },
    autoApproveLimit:       { type: Number, default: 50000 },
    committeeThreshold:     { type: Number, default: 200000 },
    maxGuaranteeMultiplier: { type: Number, default: 3 },
    minGuarantors:          { type: Number, default: 2 },
    minLiquidityRatio:      { type: Number, default: 20 },
    tenXMinShares:          { type: Number, default: 100 },
    tenXMinSavings:         { type: Number, default: 20000 },
    tenXSharesApproved:     { type: Boolean, default: false },
    tenXSavingsApproved:    { type: Boolean, default: false },
    tenXMonthlyContribution:{ type: Number, default: 1000 },
    tenXAssetPlan:          { type: String, default: 'Event equipment, such as tents and chairs' },
    adminBootstrapConsumed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Singleton helper — always returns the single config document
SystemConfigSchema.statics.getConfig = async function (): Promise<ISystemConfig> {
  let config = await this.findOne();
  if (!config) config = await this.create({});
  return config;
};

export default mongoose.model<ISystemConfig, ISystemConfigModel>('SystemConfig', SystemConfigSchema);
