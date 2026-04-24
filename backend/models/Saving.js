import mongoose from "mongoose";

const savingSchema = new mongoose.Schema(
  {
    member_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    transaction_type: {
      type: String,
      enum: ["deposit", "withdrawal", "interest"],
      required: true,
    },
    balance_before: {
      type: Number,
      required: true,
      default: 0,
    },
    balance_after: {
      type: Number,
      required: true,
    },
    interest_rate: {
      type: Number,
      default: 3, // 3% monthly interest
    },
    interest_amount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "completed",
    },
    payment_method: {
      type: String,
      enum: ["mpesa", "bank", "cash", "auto_interest"],
      default: "mpesa",
    },
    transaction_ref: {
      type: String,
      default: "",
    },
    notes: {
      type: String,
      default: "",
    },
    rejection_reason: {
      type: String,
    },
    processed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    processed_at: {
      type: Date,
    },
    lock_period_months: {
      type: Number,
      default: 0, // 0 means no lock, available immediately
    },
    unlock_date: {
      type: Date,
      default: null, // null means no lock, can withdraw anytime
    },
    maturity_status: {
      type: String,
      enum: ["locked", "matured", "withdrawn", "none"],
      default: "none", // none = no lock, locked = before unlock_date, matured = after unlock_date, withdrawn = already withdrawn
    },
    maturity_reached_date: {
      type: Date,
      default: null, // Date when the deposit matured (unlock_date reached)
    },
    // Withdrawal account details (for withdrawal requests)
    preferred_account_name: {
      type: String,
      default: "",
    },
    preferred_account_number: {
      type: String,
      default: "",
    },
    preferred_bank: {
      type: String,
      default: "",
    },
    // Early withdrawal fields
    is_early_withdrawal: {
      type: Boolean,
      default: false, // True if withdrawn before maturity_date
    },
    penalty_amount: {
      type: Number,
      default: 0, // Amount penalized for early withdrawal
    },
    penalty_percentage: {
      type: Number,
      default: 0, // Percentage of penalty applied
    },
    penalty_reason: {
      type: String,
      default: "", // Reason for penalty (e.g., "Early withdrawal - 75% lock period remaining")
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Index for faster queries
savingSchema.index({ member_id: 1, created_at: -1 });
savingSchema.index({ transaction_type: 1 });
savingSchema.index({ status: 1 });

// Unique compound index to prevent duplicate M-Pesa transactions
// Only applies when transaction_ref is not empty (sparse doesn't work on compound, so we use a partial filter)
savingSchema.index(
  { transaction_ref: 1, transaction_type: 1, member_id: 1 },
  { 
    unique: true,
    partialFilterExpression: { 
      transaction_ref: { $exists: true, $ne: "" } 
    }
  }
);

export default mongoose.model("Saving", savingSchema);
