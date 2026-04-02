import mongoose, { Schema, Document } from 'mongoose';

export interface ILoan extends Document {
  loanNumber: string;
  memberId: mongoose.Types.ObjectId;
  principal: number;
  interestRate: number;
  termMonths: number;
  monthlyInstallment: number;
  totalPayable: number;
  balance: number;
  interestModel: string;
  status: 'pending' | 'approved' | 'rejected' | 'disbursed' | 'active' | 'completed' | 'defaulted';
  riskRating: string | null;
  appliedAt: Date;
  appliedBy: mongoose.Types.ObjectId | null;
  approvedAt: Date | null;
  approvedBy: mongoose.Types.ObjectId | null;
  disbursedDate: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const LoanSchema = new Schema<ILoan>({
  loanNumber: { 
    type: String, 
    required: true, 
    unique: true 
  },
  memberId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Member',
    required: true 
  },
  principal: { 
    type: Number, 
    required: true 
  },
  interestRate: { 
    type: Number, 
    required: true 
  },
  termMonths: { 
    type: Number, 
    required: true 
  },
  monthlyInstallment: { 
    type: Number, 
    default: 0 
  },
  totalPayable: { 
    type: Number, 
    default: 0 
  },
  balance: { 
    type: Number, 
    default: 0 
  },
  interestModel: { 
    type: String, 
    default: 'reducing_balance' 
  },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected', 'disbursed', 'active', 'completed', 'defaulted'],
    default: 'pending' 
  },
  riskRating: { 
    type: String, 
    default: null 
  },
  appliedAt: { 
    type: Date, 
    default: Date.now 
  },
  appliedBy: { 
    type: Schema.Types.ObjectId, 
    ref: 'User',
    default: null 
  },
  approvedAt: { 
    type: Date, 
    default: null 
  },
  approvedBy: { 
    type: Schema.Types.ObjectId, 
    ref: 'User',
    default: null 
  },
  disbursedDate: { 
    type: Date, 
    default: null 
  },
  rejectionReason: { 
    type: String, 
    default: null 
  }
}, {
  timestamps: true
});

// Indexes (loanNumber skipped — unique: true already creates it)
LoanSchema.index({ memberId: 1 });
LoanSchema.index({ status: 1 });
LoanSchema.index({ appliedAt: -1 });

export default mongoose.model<ILoan>('Loan', LoanSchema);
