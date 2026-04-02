import mongoose from "mongoose";

const transactionFeeSchema = new mongoose.Schema({
  transaction_type: {
    type: String,
    enum: ["transfer", "top_up", "withdrawal"],
    required: true,
  },
  member_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member",
    required: true,
  },
  recipient_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member",
    // Only for transfers - who received the money
  },
  transaction_amount: {
    type: Number,
    required: true,
  },
  fee_amount: {
    type: Number,
    required: true,
  },
  payment_method: {
    type: String,
    // For top-ups: 'direct_deposit', 'stk_push', etc.
  },
  fee_description: {
    type: String,
  },
  reference_id: {
    type: String,
    // Link to related transaction (payment ID, withdrawal ID, etc.)
  },
  status: {
    type: String,
    enum: ["collected", "refunded", "pending"],
    default: "collected",
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

// Index for efficient queries
transactionFeeSchema.index({ member_id: 1, created_at: -1 });
transactionFeeSchema.index({ transaction_type: 1, created_at: -1 });
transactionFeeSchema.index({ status: 1 });

export default mongoose.model("TransactionFee", transactionFeeSchema);
