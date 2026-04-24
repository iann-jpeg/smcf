import mongoose, { Schema, Document } from 'mongoose';

export interface ISavingsHistory extends Document {
  memberId: mongoose.Types.ObjectId;
  month: string;
  amount: number;
  createdAt: Date;
}

const SavingsHistorySchema = new Schema<ISavingsHistory>({
  memberId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Member',
    required: true 
  },
  month: { 
    type: String, 
    required: true 
  },
  amount: { 
    type: Number, 
    default: 0 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Indexes
SavingsHistorySchema.index({ memberId: 1 });
SavingsHistorySchema.index({ month: 1 });
SavingsHistorySchema.index({ memberId: 1, month: 1 }, { unique: true });

export default mongoose.model<ISavingsHistory>('SavingsHistory', SavingsHistorySchema);
