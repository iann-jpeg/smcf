import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
  member_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member",
    required: true,
  },
  paid_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member",
    // Optional - only populated for payments made on behalf of others (e.g., QR payments)
  },
  amount: {
    type: Number,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  mpesa_transaction_id: {
    type: String,
    unique: true,
    sparse: true,
  },
  checkout_request_id: {
    type: String,
    sparse: true,
  },
  merchant_request_id: {
    type: String,
    sparse: true,
  },
  transaction_reference: {
    type: String,
    sparse: true,
  },
  payment_method: {
    type: String,
    enum: ["mpesa", "lipia", "cash", "bank_transfer", "admin_manual", "qr_transfer"],
    default: "lipia",
  },
  status: {
    type: String,
    enum: ["pending", "completed", "failed"],
    default: "pending",
  },
  type: {
    type: String,
    enum: ["cycle_payment", "wallet_deposit", "loan_repayment", "other"],
    default: "cycle_payment",
  },
  notes: {
    type: String,
  },
  cycle_number: {
    type: Number,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  // Track if the deposit/saving record was already created to prevent duplicates
  deposit_processed: {
    type: Boolean,
    default: false,
  },
  // Lock period for wallet deposits (in months)
  lock_period_months: {
    type: Number,
    default: 0, // 0 means no lock
  },
  loan_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Loan",
    // Optional - only populated for loan repayment payments
  },
});

export default mongoose.model("Payment", paymentSchema);
