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
  // Payment due date - default 30 days from disbursement
  due_date: {
    type: Date,
  },
  interest_rate: {
    type: Number,
    default: 0,
  },
  // Late payment fee rate - daily percentage applied to remaining balance
  late_fee_rate: {
    type: Number,
    default: 3, // 3% per day on remaining balance
  },
  // Accumulated late fees
  late_fees_accrued: {
    type: Number,
    default: 0,
  },
  // Last date late fee was calculated
  last_late_fee_date: {
    type: Date,
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
      // Track what portion was late fee vs principal
      late_fee_portion: {
        type: Number,
        default: 0,
      },
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
  // Calculate base total repayable (principal + original interest)
  const baseRepayable = this.interest_rate > 0
    ? this.amount + (this.amount * this.interest_rate) / 100
    : this.amount;
  
  // Total repayable includes late fees
  this.total_repayable = baseRepayable + (this.late_fees_accrued || 0);
  
  // Calculate remaining amount
  this.amount_remaining = this.total_repayable - (this.amount_paid || 0);
  
  // Auto-update status to 'repaid' if fully paid
  if (this.amount_remaining <= 0 && this.status === 'disbursed') {
    this.status = 'repaid';
    if (!this.repayment_date) {
      this.repayment_date = new Date();
    }
  }
  
  // Set due date when loan is disbursed (30 days from disbursement)
  if (this.status === 'disbursed' && !this.due_date && this.disbursement_date) {
    const dueDate = new Date(this.disbursement_date);
    dueDate.setDate(dueDate.getDate() + 30);
    this.due_date = dueDate;
  }
  
  this.updated_at = Date.now();
  next();
});

// Virtual to check if loan is overdue
loanSchema.virtual('is_overdue').get(function() {
  if (this.status !== 'disbursed') return false;
  if (!this.due_date) return false;
  return new Date() > this.due_date;
});

// Virtual to get days overdue
loanSchema.virtual('days_overdue').get(function() {
  if (!this.is_overdue) return 0;
  const today = new Date();
  const dueDate = new Date(this.due_date);
  return Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
});

// Virtual for payment progress percentage
loanSchema.virtual('payment_progress').get(function() {
  if (!this.total_repayable || this.total_repayable === 0) return 0;
  return Math.min(100, Math.round(((this.amount_paid || 0) / this.total_repayable) * 100));
});

// Ensure virtuals are included in JSON output
loanSchema.set('toJSON', { virtuals: true });
loanSchema.set('toObject', { virtuals: true });

export default mongoose.model("Loan", loanSchema);
