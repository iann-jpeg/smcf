import mongoose, { Schema, Document } from 'mongoose';

export interface ILoanGuarantor extends Document {
  loanId: mongoose.Types.ObjectId;
  memberId: mongoose.Types.ObjectId;
  guaranteeAmount: number;
  consentStatus: 'pending' | 'accepted' | 'rejected';
  responseNote: string | null;
  respondedAt: Date | null;
  createdAt: Date;
}

const LoanGuarantorSchema = new Schema<ILoanGuarantor>({
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
  guaranteeAmount: { 
    type: Number, 
    default: 0 
  },
  consentStatus: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending',
  },
  responseNote: { type: String, default: null },
  respondedAt:  { type: Date,   default: null },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Indexes
LoanGuarantorSchema.index({ loanId: 1 });
LoanGuarantorSchema.index({ memberId: 1 });
LoanGuarantorSchema.index({ loanId: 1, memberId: 1 }, { unique: true });

export default mongoose.model<ILoanGuarantor>('LoanGuarantor', LoanGuarantorSchema);
