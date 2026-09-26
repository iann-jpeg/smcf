import mongoose from "mongoose";

const tenXAuditLogSchema = new mongoose.Schema({
  admin_id: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
  action: { type: String, required: true },
  member_id: { type: mongoose.Schema.Types.ObjectId, ref: "Member" },
  contribution_id: { type: mongoose.Schema.Types.ObjectId, ref: "TenXContribution" },
  description: { type: String, required: true },
}, { timestamps: { createdAt: "created_at", updatedAt: false } });

export default mongoose.model("TenXAuditLog", tenXAuditLogSchema);