import mongoose, { Document, Schema } from 'mongoose';

export interface ITenXPeriod extends Document {
  period: string;
  due_amount: number;
  due_date?: Date | null;
  status: 'OPEN' | 'CLOSED';
  created_by?: mongoose.Types.ObjectId;
  updated_by?: mongoose.Types.ObjectId;
}

const schema = new Schema<ITenXPeriod>({
  period: { type: String, required: true, unique: true },
  due_amount: { type: Number, required: true, min: 0 },
  due_date: { type: Date, default: null },
  status: { type: String, enum: ['OPEN', 'CLOSED'], default: 'OPEN' },
  created_by: { type: Schema.Types.ObjectId, ref: 'User' },
  updated_by: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

export default mongoose.model<ITenXPeriod>('TenXPeriod', schema, 'tenxperiods');
