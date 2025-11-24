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
  this.updated_at = Date.now();
  next();
});

export default mongoose.model("Loan", loanSchema);
