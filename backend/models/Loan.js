import mongoose from "mongoose";

const loanSchema = new mongoose.Schema({
  member_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member",
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  purpose: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected", "disbursed", "repaid"],
    default: "pending",
  },
  approved_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
  },
  approval_date: {
    type: Date,
  },
  disbursement_date: {
    type: Date,
  },
  repayment_date: {
    type: Date,
  },
  interest_rate: {
    type: Number,
    default: 0,
  },
  total_repayable: {
    type: Number,
  },
  amount_paid: {
    type: Number,
    default: 0,
  },
  amount_remaining: {
    type: Number,
  },
  rejection_reason: {
    type: String,
  },
  notes: {
    type: String,
  },
  payment_history: [
    {
      amount: Number,
      payment_date: {
        type: Date,
        default: Date.now,
      },
      payment_method: String,
      transaction_ref: String,
      notes: String,
    },
  ],
  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
});

loanSchema.pre("save", function (next) {
  if (this.interest_rate > 0) {
    this.total_repayable =
      this.amount + (this.amount * this.interest_rate) / 100;
  } else {
    this.total_repayable = this.amount;
  }
  
  // Calculate remaining amount
  this.amount_remaining = this.total_repayable - (this.amount_paid || 0);
  
  // Auto-update status to 'repaid' if fully paid
  if (this.amount_remaining <= 0 && this.status === 'disbursed') {
    this.status = 'repaid';
    if (!this.repayment_date) {
      this.repayment_date = new Date();
    }
  }
  
  this.updated_at = Date.now();
  next();
});

export default mongoose.model("Loan", loanSchema);
