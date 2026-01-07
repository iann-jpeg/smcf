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
