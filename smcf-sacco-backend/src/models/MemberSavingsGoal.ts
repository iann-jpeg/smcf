import mongoose, { Document, Schema } from 'mongoose';

export interface IMemberSavingsGoal extends Document {
  memberId: mongoose.Types.ObjectId;
  title: string;
  description: string | null;
  targetAmount: number;
  targetDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IMemberSavingsGoal>({
  memberId: { type: Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, default: null, maxlength: 500 },
  targetAmount: { type: Number, required: true, min: 1 },
  targetDate: { type: Date, default: null },
}, { timestamps: true });

schema.index({ memberId: 1, createdAt: -1 });

export default mongoose.model<IMemberSavingsGoal>('MemberSavingsGoal', schema);
