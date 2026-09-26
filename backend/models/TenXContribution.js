import mongoose from "mongoose";

const tenXContributionSchema = new mongoose.Schema({
  member_id: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },
  group_id: { type: String, default: "10X" },
  period_id: { type: mongoose.Schema.Types.ObjectId, ref: "TenXPeriod", required: true },
  period: { type: String, required: true },
  amount_due: { type: Number, required: true, min: 0 },
  amount_paid: { type: Number, default: 0, min: 0 },
  payment_date: { type: Date },
  payment_method: { type: String },
  transaction_reference: { type: String },
  payment_id: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" },
  status: { type: String, enum: ["PENDING", "SUCCESSFUL", "FAILED", "CANCELLED"], default: "PENDING" },
  source: { type: String, enum: ["AUTOMATIC", "MANUAL"], default: "AUTOMATIC" },
  receipt_number: { type: String, unique: true, sparse: true },
  recorded_by: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  notes: { type: String },
}, { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } });

tenXContributionSchema.index({ member_id: 1, period_id: 1, status: 1 });
tenXContributionSchema.index({ period_id: 1, status: 1 });
tenXContributionSchema.index(
  { member_id: 1, period_id: 1 },
  { unique: true, partialFilterExpression: { status: "SUCCESSFUL" } }
);

export default mongoose.model("TenXContribution", tenXContributionSchema);