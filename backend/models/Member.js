import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const memberSchema = new mongoose.Schema({
  member_id: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
    select: false,
  },
  id_number: {
    type: String,
    required: false,
    default: "",
  },
  status: {
    type: String,
    enum: ["active", "inactive", "suspended"],
    default: "active",
  },
  member_type: {
    type: String,
    enum: ["regular", "wallet_only"],
    default: "regular",
  },
  payment_status: {
    type: String,
    enum: ["paid", "pending"],
    default: "pending",
  },
  position: {
    type: Number,
    default: 0,
  },
  monthly_contribution: {
    type: Number,
    default: 224, // Updated from 204 to 224
  },
  join_date: {
    type: Date,
    default: Date.now,
  },
  amount: {
    type: Number,
    default: 0,
  },
  payment_date: {
    type: Date,
  },
  total_contributed: {
    type: Number,
    default: 0, // Members start with zero contributions
  },
  total_received: {
    type: Number,
    default: 0,
  },
  last_payout_date: {
    type: Date,
  },
  last_payout_amount: {
    type: Number,
    default: 0,
  },
  next_payout_cycle: {
    type: Number,
  },
  disbursement_status: {
    type: String,
    enum: ["pending", "received", "skipped"],
    default: "pending",
  },
  disbursement_position: {
    type: Number,
    default: 0,
  },
  total_savings: {
    type: Number,
    default: 0,
  },
  wallet_balance: {
    type: Number,
    default: 0,
  },
  // Payment breakdown fields (KES 224 split)
  total_cycle_contribution: {
    type: Number,
    default: 0, // KES 200 per payment
  },
  total_member_credit: {
    type: Number,
    default: 0, // KES 20 per payment
  },
  total_transaction_fees: {
    type: Number,
    default: 0, // KES 4 per payment
  },
  registered_by_admin: {
    type: Boolean,
    default: true,
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

memberSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    this.updated_at = Date.now();
    return next();
  }
  if (this.password) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  this.updated_at = Date.now();
  next();
});

memberSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model("Member", memberSchema);
