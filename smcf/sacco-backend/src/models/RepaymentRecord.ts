import mongoose, { Schema, Document } from 'mongoose';

export interface IRepaymentRecord extends Document {
  loanId: mongoose.Types.ObjectId;
  memberId: mongoose.Types.ObjectId;
  dueDate: Date;
  amountDue: number;
  amountPaid: number;
  paidDate: Date | null;
  status: 'pending' | 'paid' | 'overdue' | 'partial';
  createdAt: Date;
}

const RepaymentRecordSchema = new Schema<IRepaymentRecord>({
  loanId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Loan',
    required: true 
  },
  memberId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Member',
    required: true 
  },
  dueDate: { 
    type: Date, 
    required: true 
  },
  amountDue: { 
    type: Number, 
    required: true 
  },
  amountPaid: { 
    type: Number, 
    default: 0 
  },
  paidDate: { 
    type: Date, 
    default: null 
  },
  status: { 
    type: String, 
    enum: ['pending', 'paid', 'overdue', 'partial'],
    default: 'pending' 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Indexes
RepaymentRecordSchema.index({ loanId: 1 });
RepaymentRecordSchema.index({ memberId: 1 });
RepaymentRecordSchema.index({ dueDate: 1 });
RepaymentRecordSchema.index({ status: 1 });

export default mongoose.model<IRepaymentRecord>('RepaymentRecord', RepaymentRecordSchema);
