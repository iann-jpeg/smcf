import mongoose, { Document, Schema } from 'mongoose';

export interface ITenXContribution extends Document {
  member_id: mongoose.Types.ObjectId;
  group_id: string;
  period_id: mongoose.Types.ObjectId;
  period: string;
  amount_due: number;
  amount_paid: number;
  payment_date?: Date | null;
  payment_method?: string;
  transaction_reference?: string;
  payment_id?: mongoose.Types.ObjectId;
  status: 'PENDING' | 'SUCCESSFUL' | 'FAILED' | 'CANCELLED';
  source: 'AUTOMATIC' | 'MANUAL';
  receipt_number?: string;
  recorded_by?: mongoose.Types.ObjectId;
  notes?: string;
}

const schema = new Schema<ITenXContribution>({
  member_id: { type: Schema.Types.ObjectId, ref: 'Member', required: true },
  group_id: { type: String, default: '10X' },
  period_id: { type: Schema.Types.ObjectId, ref: 'TenXPeriod', required: true },
  period: { type: String, required: true },
  amount_due: { type: Number, required: true, min: 0 },
  amount_paid: { type: Number, default: 0, min: 0 },
  payment_date: { type: Date, default: null },
  payment_method: { type: String },
  transaction_reference: { type: String },
  payment_id: { type: Schema.Types.ObjectId, ref: 'Payment' },
  status: { type: String, enum: ['PENDING', 'SUCCESSFUL', 'FAILED', 'CANCELLED'], default: 'PENDING' },
  source: { type: String, enum: ['AUTOMATIC', 'MANUAL'], default: 'AUTOMATIC' },
  receipt_number: { type: String, unique: true, sparse: true },
  recorded_by: { type: Schema.Types.ObjectId, ref: 'User' },
  notes: { type: String },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

schema.index({ member_id: 1, period_id: 1, status: 1 });
schema.index({ member_id: 1, period_id: 1 }, { unique: true, partialFilterExpression: { status: 'SUCCESSFUL' } });

export default mongoose.model<ITenXContribution>('TenXContribution', schema, 'tenxcontributions');
