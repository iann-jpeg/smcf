import mongoose from "mongoose";

const memberMessageSchema = new mongoose.Schema({
  source: {
    type: String,
    enum: ["member-dashboard", "members-section", "landing-page"],
    default: "member-dashboard",
  },
  member_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member",
    default: null,
  },
  sender_name: {
    type: String,
    required: true,
    trim: true,
  },
  sender_contact: {
    type: String,
    default: "",
    trim: true,
  },
  subject: {
    type: String,
    required: true,
    trim: true,
  },
  message: {
    type: String,
    required: true,
    trim: true,
  },
  status: {
    type: String,
    enum: ["new", "read"],
    default: "new",
  },
  read_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
    default: null,
  },
  read_at: {
    type: Date,
    default: null,
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

memberMessageSchema.pre("save", function (next) {
  this.updated_at = Date.now();
  next();
});

memberMessageSchema.index({ created_at: -1 });
memberMessageSchema.index({ status: 1, created_at: -1 });
memberMessageSchema.index({ source: 1, created_at: -1 });

export default mongoose.model("MemberMessage", memberMessageSchema);
