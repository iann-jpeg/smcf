import mongoose, { Schema, Document } from 'mongoose';

export interface ISavingsInterestDistribution extends Document {
  period: string;
  totalProfit: number;
  interestRate: number;
  totalSavingsEligible: number;
  totalInterest: number;
  membersCount: number;
  approvedBy: Schema.Types.ObjectId;
  approvedAt: Date;
  createdAt: Date;
  distributionId: string;
}

const SavingsInterestDistributionSchema = new Schema<ISavingsInterestDistribution>(
  {
    period: { type: String, required: true, index: true, unique: true },
    totalProfit: { type: Number, required: true, min: 0 },
    interestRate: { type: Number, required: true, min: 0 },
    totalSavingsEligible: { type: Number, required: true, min: 0 },
    totalInterest: { type: Number, required: true, min: 0 },
    membersCount: { type: Number, required: true, min: 0 },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    approvedAt: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now, index: true },
    distributionId: { type: String, unique: true, sparse: true, index: true },
  },
  { timestamps: true }
);

SavingsInterestDistributionSchema.index({ approvedAt: -1 });

export default mongoose.model<ISavingsInterestDistribution>(
  'SavingsInterestDistribution',
  SavingsInterestDistributionSchema
);

export interface ISavingsInterestStatement extends Document {
  distributionId: Schema.Types.ObjectId;
  memberId: Schema.Types.ObjectId;
  memberName: string;
  savingsBefore: number;
  interestAmount: number;
  savingsAfter: number;
  createdAt: Date;
}

const SavingsInterestStatementSchema = new Schema<ISavingsInterestStatement>(
  {
    distributionId: { type: Schema.Types.ObjectId, ref: 'SavingsInterestDistribution', required: true, index: true },
    memberId: { type: Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
    memberName: { type: String, required: true },
    savingsBefore: { type: Number, required: true, min: 0 },
    interestAmount: { type: Number, required: true, min: 0 },
    savingsAfter: { type: Number, required: true, min: 0 },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

SavingsInterestStatementSchema.index({ distributionId: 1, memberId: 1 });

export const SavingsInterestStatementModel = mongoose.model<ISavingsInterestStatement>(
  'SavingsInterestStatement',
  SavingsInterestStatementSchema
);
