import mongoose from "mongoose";

const tenXPeriodSchema = new mongoose.Schema({
  period: { type: String, required: true, unique: true },
  due_amount: { type: Number, required: true, min: 0 },
  due_date: { type: Date },
  status: { type: String, enum: ["OPEN", "CLOSED"], default: "OPEN" },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  updated_by: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
}, { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } });

export default mongoose.model("TenXPeriod", tenXPeriodSchema);