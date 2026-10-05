import mongoose, { Document, Schema } from 'mongoose';

export interface ICardSubscription extends Document {
  memberId: mongoose.Types.ObjectId;
  amount: number;
  currency: string;
  purpose: 'savings' | 'wallet' | 'cycle';
  frequency: 'monthly';
  status: 'pending' | 'active' | 'paused' | 'cancelled' | 'failed';
  provider: 'pesapal';
  providerSubscriptionId?: string | null;
  providerCustomerReference?: string | null;
  nextPaymentDate?: Date | null;
  consentAcceptedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CardSubscriptionSchema = new Schema<ICardSubscription>({
  memberId: { type: Schema.Types.ObjectId, ref: 'Member', required: true },
  amount: { type: Number, required: true, min: 1 },
  currency: { type: String, default: 'KES' },
  purpose: { type: String, enum: ['savings', 'wallet', 'cycle'], required: true },
  frequency: { type: String, enum: ['monthly'], default: 'monthly' },
  status: { type: String, enum: ['pending', 'active', 'paused', 'cancelled', 'failed'], default: 'pending' },
  provider: { type: String, enum: ['pesapal'], default: 'pesapal' },
  providerSubscriptionId: { type: String, default: null },
  providerCustomerReference: { type: String, default: null },
  nextPaymentDate: { type: Date, default: null },
  consentAcceptedAt: { type: Date, required: true },
}, { timestamps: true });

CardSubscriptionSchema.index({ memberId: 1, status: 1 });
CardSubscriptionSchema.index({ providerSubscriptionId: 1 }, { sparse: true });

export default mongoose.model<ICardSubscription>('CardSubscription', CardSubscriptionSchema);
