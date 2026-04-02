import mongoose, { Schema, Document } from 'mongoose';

export interface ILoanApproval extends Document {
  loanId: mongoose.Types.ObjectId;
  approverId: mongoose.Types.ObjectId;
  approvalLevel: string;
  decision: 'approved' | 'rejected' | 'pending';
  notes: string | null;
  createdAt: Date;
}

const LoanApprovalSchema = new Schema<ILoanApproval>({
  loanId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Loan',
    required: true 
  },
  approverId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  approvalLevel: { 
    type: String, 
    required: true 
  },
  decision: { 
    type: String, 
    enum: ['approved', 'rejected', 'pending'],
    required: true 
  },
  notes: { 
    type: String, 
    default: null 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Indexes
LoanApprovalSchema.index({ loanId: 1 });
LoanApprovalSchema.index({ approverId: 1 });

export default mongoose.model<ILoanApproval>('LoanApproval', LoanApprovalSchema);
