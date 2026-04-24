import mongoose from "mongoose";

const reserveTransactionSchema = new mongoose.Schema({
  // Transaction type
  transaction_type: {
    type: String,
    enum: [
      "credit", // Money added to reserve
      "debit",  // Money withdrawn from reserve
    ],
    required: true,
  },
  
  // Source/purpose
  source_type: {
    type: String,
    enum: [
      "early_withdrawal_penalty",
      "loan_default_penalty",
      "loan_interest",
      "withdrawal_fee",
      "system_fee",
      "cycle_contribution",
      "admin_withdrawal",
      "admin_adjustment",
      "other",
    ],
    required: true,
  },
  
  // Amount
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  
  // Balance after this transaction
  balance_after: {
    type: Number,
    required: true,
    min: 0,
  },
  
  // Description
  description: {
    type: String,
    required: true,
  },
  
  // Reference to source transaction
  reference_type: {
    type: String,
    enum: ["Saving", "Loan", "Payment", "Cycle", "TransactionFee", "Manual", "Other"],
  },
  reference_id: {
    type: String, // Can be ObjectId or other identifier
  },
  
  // For withdrawals only
  withdrawal_reason: {
    type: String,
    enum: [
      "loan_default_coverage",
      "emergency_group_support",
      "operational_costs",
      "group_investment",
      "member_refund",
      "audit_adjustment",
      "other",
    ],
  },
  withdrawal_notes: {
    type: String,
  },
  
  // Approval tracking (for withdrawals)
  approved_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
  },
  secondary_approval_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
  },
  approval_status: {
    type: String,
    enum: ["pending", "approved", "rejected", "completed"],
    default: "completed", // Auto-completed for credits, pending for withdrawals
  },
  
  // Audit trail
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
  },
  created_at: {
    type: Date,
    default: Date.now,
    immutable: true, // Cannot be changed after creation
  },
  
  // Metadata
  metadata: {
    type: Map,
    of: String, // Store additional info as key-value pairs
  },
  
  // System flags
  is_automated: {
    type: Boolean,
    default: false, // True if automatically created by system
  },
  is_reversed: {
    type: Boolean,
    default: false,
  },
  reversal_reference: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ReserveTransaction",
  },
});

// Indexes for faster queries
reserveTransactionSchema.index({ created_at: -1 });
reserveTransactionSchema.index({ source_type: 1 });
reserveTransactionSchema.index({ transaction_type: 1 });
reserveTransactionSchema.index({ reference_id: 1 });
reserveTransactionSchema.index({ approval_status: 1 });

// Virtual for member reference (if applicable)
reserveTransactionSchema.virtual("member", {
  ref: "Member",
  localField: "metadata.member_id",
  foreignField: "_id",
  justOne: true,
});

export default mongoose.model("ReserveTransaction", reserveTransactionSchema);
