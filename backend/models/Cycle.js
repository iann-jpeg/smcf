import mongoose from "mongoose";

const cycleSchema = new mongoose.Schema({
  cycle_number: {
    type: Number,
    required: true,
    unique: true,
  },
  start_date: {
    type: Date,
    required: true,
  },
  end_date: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ["active", "completed", "pending"],
    default: "active",
  },
  total_amount_collected: {
    type: Number,
    default: 0,
  },
  total_members: {
    type: Number,
    default: 0,
  },
  paid_members_count: {
    type: Number,
    default: 0,
  },
  next_recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member",
  },
  recipient_paid: {
    type: Boolean,
    default: false,
  },
  disbursement_date: {
    type: Date,
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

cycleSchema.pre("save", function (next) {
  this.updated_at = Date.now();
  next();
});

export default mongoose.model("Cycle", cycleSchema);
