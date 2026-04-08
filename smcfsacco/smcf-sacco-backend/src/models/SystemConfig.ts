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
  sharePurchaseEnabled: boolean;
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
    sharePurchaseEnabled:   { type: Boolean, default: true },
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
