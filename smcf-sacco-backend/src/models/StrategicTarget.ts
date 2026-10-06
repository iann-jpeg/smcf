import mongoose, { Document, Schema } from 'mongoose';

export type StrategicMetric = 'membership' | 'savings' | 'loans' | 'revenue' | 'expenses';

export interface IStrategicTarget extends Document {
  metric: StrategicMetric;
  name: string;
  targetValue: number;
  unit: 'count' | 'currency';
  periodStart: Date;
  periodEnd: Date;
  owner: string | null;
  notes: string | null;
  active: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IStrategicTarget>({
  metric: { type: String, enum: ['membership', 'savings', 'loans', 'revenue', 'expenses'], required: true },
  name: { type: String, required: true, trim: true, maxlength: 160 },
  targetValue: { type: Number, required: true, min: 0 },
  unit: { type: String, enum: ['count', 'currency'], required: true },
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  owner: { type: String, default: null, maxlength: 120 },
  notes: { type: String, default: null, maxlength: 1000 },
  active: { type: Boolean, default: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

schema.index({ metric: 1, active: 1, periodEnd: 1 });

export default mongoose.model<IStrategicTarget>('StrategicTarget', schema);
