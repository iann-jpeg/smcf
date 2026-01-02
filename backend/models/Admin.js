import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const adminSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
    unique: true,
  },
  role: {
    type: String,
    enum: ["superadmin", "admin", "treasurer", "secretary", "auditor", "viewer"],
    default: "admin",
  },
  password: {
    type: String,
    select: false,
  },
  is_active: {
    type: Boolean,
    default: true,
  },
  permissions: {
    canAddMembers: { type: Boolean, default: true },
    canEditMembers: { type: Boolean, default: true },
    canDeleteMembers: { type: Boolean, default: false },
    canDisburseFunds: { type: Boolean, default: true },
    canApproveLoans: { type: Boolean, default: true },
    canViewReports: { type: Boolean, default: true },
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

adminSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  if (this.password) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  this.updated_at = Date.now();
  next();
});

adminSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model("Admin", adminSchema);
