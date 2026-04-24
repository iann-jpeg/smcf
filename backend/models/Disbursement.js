import mongoose from "mongoose";

const disbursementSchema = new mongoose.Schema({
  cycle_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Cycle",
    required: true,
  },
  recipient_id: {
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
  status: {
    type: String,
    enum: ["pending", "processing", "completed", "failed"],
    default: "pending",
  },
  initiated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
    required: true,
  },
  disbursement_date: {
    type: Date,
    default: Date.now,
  },
  notes: {
    type: String,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model("Disbursement", disbursementSchema);
