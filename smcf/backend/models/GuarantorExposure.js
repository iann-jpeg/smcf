import mongoose from "mongoose";

const guarantorExposureSchema = new mongoose.Schema({
  guarantor_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member",
    required: true,
    unique: true,
    index: true,
  },
  total_guaranteed_amount: {
    type: Number,
    default: 0,
    required: true,
  },
  active_guarantee_count: {
    type: Number,
    default: 0,
    required: true,
  },
  pending_guarantee_count: {
    type: Number,
    default: 0,
  },
  total_recovered_amount: {
    type: Number,
    default: 0,
  },
  default_history: [
    {
      loan_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Loan",
      },
      borrower_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Member",
      },
      defaulted_amount: Number,
      recovered_amount: Number,
      defaulted_at: Date,
      status: {
        type: String,
        enum: ["active", "partially_recovered", "fully_recovered"],
        default: "active",
      },
    },
  ],
  // Risk metrics
  risk_score: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  is_blacklisted: {
    type: Boolean,
    default: false,
  },
  blacklist_reason: {
    type: String,
    default: "",
  },
  blacklisted_at: {
    type: Date,
    default: null,
  },
  max_guarantee_capacity: {
    type: Number,
    default: 0,
  },
  last_updated: {
    type: Date,
    default: Date.now,
  },
  created_at: {
    type: Date,
    default: Date.now,
    immutable: true,
  },
});

// Update timestamp on save
guarantorExposureSchema.pre("save", function (next) {
  this.last_updated = new Date();
  next();
});

// Virtual for available guarantee capacity
guarantorExposureSchema.virtual("available_capacity").get(function () {
  return Math.max(0, this.max_guarantee_capacity - this.total_guaranteed_amount);
});

// Virtual for utilization percentage
guarantorExposureSchema.virtual("utilization_percentage").get(function () {
  if (this.max_guarantee_capacity === 0) return 0;
  return (this.total_guaranteed_amount / this.max_guarantee_capacity) * 100;
});

// Static method to calculate max capacity (3x savings balance)
guarantorExposureSchema.statics.calculateMaxCapacity = function (savingsBalance) {
  return savingsBalance * 3;
};

// Static method to update exposure
guarantorExposureSchema.statics.updateExposure = async function (guarantorId) {
  const LoanGuarantor = mongoose.model("LoanGuarantor");
  const Loan = mongoose.model("Loan");
  
  // Get all active guarantees
  const guarantees = await LoanGuarantor.find({
    guarantor_id: guarantorId,
    status: "accepted",
  }).populate("loan_id");

  let totalAmount = 0;
  let activeCount = 0;

  for (const guarantee of guarantees) {
    if (guarantee.loan_id && guarantee.loan_id.status !== "cleared" && guarantee.loan_id.status !== "rejected") {
      totalAmount += guarantee.liability_amount || 0;
      activeCount++;
    }
  }

  // Get pending guarantees
  const pendingCount = await LoanGuarantor.countDocuments({
    guarantor_id: guarantorId,
    status: "pending",
  });

  // Update or create exposure record
  await this.findOneAndUpdate(
    { guarantor_id: guarantorId },
    {
      total_guaranteed_amount: totalAmount,
      active_guarantee_count: activeCount,
      pending_guarantee_count: pendingCount,
    },
    { upsert: true, new: true }
  );
};

const GuarantorExposure = mongoose.model("GuarantorExposure", guarantorExposureSchema);

export default GuarantorExposure;
