import mongoose from "mongoose";

/**
 * LoanTermsAcceptance Model
 * 
 * Stores legally binding acceptance records for loan applications
 * Compliant with Kenyan Data Protection Act, 2019
 * Required for audit trail and dispute resolution
 */
const loanTermsAcceptanceSchema = new mongoose.Schema({
  member_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member",
    required: true,
    index: true,
  },
  loan_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Loan",
    default: null,
    index: true,
  },
  // Policy version for tracking changes to terms
  policy_version: {
    type: String,
    required: true,
    default: "SMCF-LOAN-POLICY-2026-01",
  },
  // Timestamp of acceptance (legally binding signature)
  accepted_at: {
    type: Date,
    required: true,
    default: Date.now,
  },
  // IP Address for legal audit trail
  ip_address: {
    type: String,
    required: true,
  },
  // Browser user agent for device identification
  user_agent: {
    type: String,
    required: true,
  },
  // Additional metadata
  member_name: {
    type: String,
  },
  member_phone: {
    type: String,
  },
  // Indicates if this acceptance is still valid
  is_valid: {
    type: Boolean,
    default: true,
  },
  // Notes for admin/legal purposes
  notes: {
    type: String,
  },
}, {
  timestamps: true, // Adds createdAt and updatedAt
});

// Index for fast lookups (member_id and loan_id already have index: true in schema)
loanTermsAcceptanceSchema.index({ member_id: 1, policy_version: 1 });
loanTermsAcceptanceSchema.index({ accepted_at: -1 });

// Static method to check if member has accepted current policy version
loanTermsAcceptanceSchema.statics.hasAcceptedCurrentVersion = async function(memberId, policyVersion = "SMCF-LOAN-POLICY-2026-01") {
  const acceptance = await this.findOne({
    member_id: memberId,
    policy_version: policyVersion,
    is_valid: true,
  }).sort({ accepted_at: -1 });
  
  return !!acceptance;
};

// Static method to create acceptance record
loanTermsAcceptanceSchema.statics.createAcceptance = async function(data) {
  return await this.create({
    member_id: data.memberId,
    loan_id: data.loanId || null,
    policy_version: data.policyVersion || "SMCF-LOAN-POLICY-2026-01",
    ip_address: data.ipAddress,
    user_agent: data.userAgent,
    member_name: data.memberName,
    member_phone: data.memberPhone,
    notes: data.notes,
  });
};

const LoanTermsAcceptance = mongoose.model("LoanTermsAcceptance", loanTermsAcceptanceSchema);

export default LoanTermsAcceptance;
