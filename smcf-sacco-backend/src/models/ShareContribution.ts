import mongoose, { Schema, Document } from 'mongoose';

export type ShareContributionStatus = 'pending' | 'approved' | 'reversed' | 'rejected';

export interface IShareContribution extends Document {
  memberId: mongoose.Types.ObjectId;
  amount: number;
  numberOfShares: number;
  shareValuePerShare: number;
  paymentMethod: string;
  referenceNumber: string | null;
  contributionDate: Date;
  recordedBy: mongoose.Types.ObjectId;
  status: ShareContributionStatus;
  approvedBy: mongoose.Types.ObjectId | null;
  approvedAt: Date | null;
  reversedBy: mongoose.Types.ObjectId | null;
  reversedAt: Date | null;
  reversalReason: string | null;
  notes: string | null;
  source: 'manual' | 'mpesa' | 'system';
  transactionRef: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const ShareContributionSchema = new Schema<IShareContribution>(
  {
    memberId: { type: Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
    amount: { type: Number, required: true, min: 1 },
    numberOfShares: { type: Number, required: true, min: 0.01 },
    shareValuePerShare: { type: Number, required: true, min: 1, default: 100 },
    paymentMethod: { type: String, required: true, trim: true },
    referenceNumber: { type: String, default: null, trim: true },
    contributionDate: { type: Date, default: Date.now, index: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'reversed', 'rejected'],
      default: 'pending',
      index: true,
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    reversedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reversedAt: { type: Date, default: null },
    reversalReason: { type: String, default: null },
    notes: { type: String, default: null },
    source: {
      type: String,
      enum: ['manual', 'mpesa', 'system'],
      default: 'manual',
    },
    transactionRef: { type: String, default: null },
  },
  {
    timestamps: true,
  }
);

ShareContributionSchema.index({ memberId: 1, status: 1, contributionDate: -1 });
ShareContributionSchema.index({ referenceNumber: 1 }, { sparse: true });

export default mongoose.model<IShareContribution>('ShareContribution', ShareContributionSchema);
