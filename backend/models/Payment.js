import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
  member_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member",
    required: true,
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
    enum: ["mpesa", "lipia", "cash", "bank_transfer"],
    default: "lipia",
  },
  status: {
    type: String,
    enum: ["pending", "completed", "failed"],
    default: "pending",
  },
  cycle_number: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model("Payment", paymentSchema);
