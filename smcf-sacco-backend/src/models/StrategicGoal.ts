import mongoose, { Document, Schema } from 'mongoose';

export interface IStrategicMilestone {
  title: string;
  dueDate: Date;
  completed: boolean;
  completedAt: Date | null;
}

export interface IStrategicGoal extends Document {
  title: string;
  description: string | null;
  owner: string | null;
  status: 'planned' | 'in_progress' | 'at_risk' | 'completed' | 'paused';
  startsAt: Date;
  dueDate: Date;
  milestones: IStrategicMilestone[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const milestoneSchema = new Schema<IStrategicMilestone>({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  dueDate: { type: Date, required: true },
  completed: { type: Boolean, default: false },
  completedAt: { type: Date, default: null },
}, { _id: true });

const schema = new Schema<IStrategicGoal>({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, default: null, maxlength: 2000 },
  owner: { type: String, default: null, maxlength: 120 },
  status: { type: String, enum: ['planned', 'in_progress', 'at_risk', 'completed', 'paused'], default: 'planned' },
  startsAt: { type: Date, required: true },
  dueDate: { type: Date, required: true },
  milestones: { type: [milestoneSchema], default: [] },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

schema.index({ dueDate: 1, status: 1 });

export default mongoose.model<IStrategicGoal>('StrategicGoal', schema);
