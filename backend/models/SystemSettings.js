import mongoose from "mongoose";

const systemSettingsSchema = new mongoose.Schema({
  // Early Withdrawal Settings
  early_withdrawal_enabled: {
    type: Boolean,
    default: false, // Disabled by default - admin must enable
  },
  early_withdrawal_penalty_type: {
    type: String,
    enum: ["fixed", "dynamic"], // fixed = same % always, dynamic = based on time remaining
    default: "dynamic",
  },
  early_withdrawal_base_penalty: {
    type: Number,
    default: 10, // Base penalty percentage (e.g., 10%)
    min: 0,
    max: 50, // Max 50% penalty
  },
  early_withdrawal_dynamic_rates: {
    // Dynamic penalties based on % of lock period remaining
    // E.g., if 80% of lock period remains, apply higher penalty
    over_75_percent: { type: Number, default: 20 }, // 20% penalty if >75% time remains
    over_50_percent: { type: Number, default: 15 }, // 15% penalty if >50% time remains
    over_25_percent: { type: Number, default: 10 }, // 10% penalty if >25% time remains
    under_25_percent: { type: Number, default: 5 },  // 5% penalty if <25% time remains
  },
  // Group Reserve Account
  reserve_account_enabled: {
    type: Boolean,
    default: true,
  },
  total_reserve_balance: {
    type: Number,
    default: 0, // Total accumulated from penalties, fees, etc.
  },
  // Credit Score Impact
  early_withdrawal_credit_penalty: {
    type: Number,
    default: 10, // Points deducted from credit score per early withdrawal
    min: 0,
    max: 50,
  },
  // Updated timestamp
  updated_at: {
    type: Date,
    default: Date.now,
  },
  updated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
  },
});

// Update timestamp on save
systemSettingsSchema.pre("save", function (next) {
  this.updated_at = Date.now();
  next();
});

export default mongoose.model("SystemSettings", systemSettingsSchema);
