import mongoose from "mongoose";

const loanGuarantorSchema = new mongoose.Schema({
  loan_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Loan",
    required: true,
    index: true,
  },
  borrower_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member",
    required: true,
    index: true,
  },
  guarantor_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member",
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "declined"],
    default: "pending",
    required: true,
  },
  accepted_at: {
    type: Date,
    default: null,
  },
  declined_at: {
    type: Date,
    default: null,
  },
  decline_reason: {
    type: String,
    default: "",
  },
  ip_address: {
    type: String,
    default: "",
  },
  policy_version: {
    type: String,
    default: "1.0",
  },
  legal_acceptance_text: {
    type: String,
    default: "",
  },
  // Joint and several liability tracking
  liability_amount: {
    type: Number,
    default: 0,
  },
  recovered_amount: {
    type: Number,
    default: 0,
  },
  recovery_deductions: [
    {
      amount: Number,
      date: Date,
      admin_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin",
      },
      notes: String,
      remaining_balance: Number,
    },
  ],
  // Audit trail
  notification_sent_at: {
    type: Date,
    default: null,
  },
  notification_read_at: {
    type: Date,
    default: null,
  },
  created_at: {
    type: Date,
    default: Date.now,
    immutable: true,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
});

// Compound indexes for performance
loanGuarantorSchema.index({ loan_id: 1, guarantor_id: 1 }, { unique: true });
loanGuarantorSchema.index({ guarantor_id: 1, status: 1 });
loanGuarantorSchema.index({ borrower_id: 1, loan_id: 1 });

// Update timestamp on save
loanGuarantorSchema.pre("save", function (next) {
  this.updated_at = new Date();
  next();
});

// Virtual for calculating remaining liability
loanGuarantorSchema.virtual("remaining_liability").get(function () {
  return this.liability_amount - this.recovered_amount;
});

const LoanGuarantor = mongoose.model("LoanGuarantor", loanGuarantorSchema);

export default LoanGuarantor;
