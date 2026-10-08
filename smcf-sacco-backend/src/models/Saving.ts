import mongoose, { Document, Schema } from 'mongoose';

export interface ISaving extends Document {
  member_id: mongoose.Types.ObjectId;
  amount: number;
  fee_amount?: number;
  net_amount?: number;
  account_name?: string;
  account_number?: string;
  bank_name?: string;
  transaction_type: 'deposit' | 'withdrawal' | 'interest' | 'adjustment';
  adjustment_direction?: 'credit' | 'debit';
  balance_before: number;
  balance_after: number;
  interest_rate?: number;
  interest_amount?: number;
  status: 'pending' | 'completed' | 'failed';
  payment_method?: string;
  transaction_ref?: string;
  notes?: string;
  rejection_reason?: string;
  lock_period_months?: number;
  unlock_date?: Date | null;
  maturity_status?: 'locked' | 'matured' | 'withdrawn' | 'none';
  processed_at?: Date | null;
  created_at: Date;
}

const schema = new Schema<ISaving>({
  member_id: { type: Schema.Types.ObjectId, ref: 'Member', required: true },
  amount: { type: Number, required: true, min: 0 },
  fee_amount: { type: Number, default: 0, min: 0 },
  net_amount: { type: Number, default: null, min: 0 },
  account_name: { type: String, default: '' },
  account_number: { type: String, default: '' },
  bank_name: { type: String, default: '' },
  transaction_type: { type: String, enum: ['deposit', 'withdrawal', 'interest', 'adjustment'], required: true },
  adjustment_direction: { type: String, enum: ['credit', 'debit'] },
  balance_before: { type: Number, required: true, default: 0 },
  balance_after: { type: Number, required: true },
  interest_rate: { type: Number, default: 3 },
  interest_amount: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'completed' },
  payment_method: { type: String, default: 'mpesa' },
  transaction_ref: { type: String, default: '' },
  notes: { type: String, default: '' },
  rejection_reason: { type: String },
  lock_period_months: { type: Number, default: 3 },
  unlock_date: { type: Date, default: null },
  maturity_status: { type: String, enum: ['locked', 'matured', 'withdrawn', 'none'], default: 'none' },
  processed_at: { type: Date, default: null },
  created_at: { type: Date, default: Date.now },
}, { timestamps: true, collection: 'savings' });

schema.index({ member_id: 1, created_at: -1 });
schema.index({ transaction_type: 1, status: 1 });

export default mongoose.model<ISaving>('Saving', schema);
