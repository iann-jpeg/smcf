import mongoose, { Schema, Document } from 'mongoose';

export interface IMember extends Document {
  memberId: string;
  name: string;
  email: string | null;
  phone: string | null;
  userId: mongoose.Types.ObjectId | null;
  joinDate: Date;
  status: 'active' | 'inactive' | 'suspended';
  savings: number;
  shares: number;
  loanBalance: number;
  riskScore: number | null;
  kycVerified: boolean;
  kycVerifiedAt: Date | null;
  kycVerifiedBy: mongoose.Types.ObjectId | null;
  profilePhoto: string | null;
  // Extended profile
  nationalId: string | null;
  dateOfBirth: Date | null;
  gender: 'male' | 'female' | 'other' | null;
  county: string | null;
  occupation: string | null;
  employer: string | null;
  // KYC Documents (base64 data URLs)
  docIdCopy: string | null;
  docPassportPhoto: string | null;
  docMembershipForm: string | null;
  docKraPinCertificate: string | null;
  registrationFeePaid: boolean;
  registrationFeeAmount: number;
  registrationFeeMpesaCode: string | null;
  registrationFeeDate: Date | null;
  registrationFeePhone: string | null;
  registrationFeeTransactionId: string | null;
  registrationFeePendingCheckoutId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const MemberSchema = new Schema<IMember>({
  memberId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  name: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    sparse: true,
    lowercase: true 
  },
  phone: { 
    type: String, 
    sparse: true 
  },
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User',
    default: null 
  },
  joinDate: { 
    type: Date, 
    default: Date.now 
  },
  status: { 
    type: String, 
    enum: ['active', 'inactive', 'suspended'],
    default: 'active' 
  },
  savings: { 
    type: Number, 
    default: 0 
  },
  shares: { 
    type: Number, 
    default: 0 
  },
  loanBalance: { 
    type: Number, 
    default: 0 
  },
  riskScore: { 
    type: Number, 
    default: null 
  },
  kycVerified: { 
    type: Boolean, 
    default: false 
  },
  kycVerifiedAt: { 
    type: Date, 
    default: null 
  },
  kycVerifiedBy: { 
    type: Schema.Types.ObjectId, 
    ref: 'User',
    default: null 
  },
  profilePhoto: {
    type: String,
    default: null
  },
  // Extended profile
  nationalId: {
    type: String,
    default: null
  },
  dateOfBirth: {
    type: Date,
    default: null
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other', null],
    default: null
  },
  county: {
    type: String,
    default: null
  },
  occupation: {
    type: String,
    default: null
  },
  employer: {
    type: String,
    default: null
  },
  // KYC Documents (base64 data URLs)
  docIdCopy: {
    type: String,
    default: null
  },
  docPassportPhoto: {
    type: String,
    default: null
  },
  docMembershipForm: {
    type: String,
    default: null
  },
  docKraPinCertificate: {
    type: String,
    default: null
  },
  registrationFeePaid: {
    type: Boolean,
    default: false
  },
  registrationFeeAmount: {
    type: Number,
    default: 100
  },
  registrationFeeMpesaCode: {
    type: String,
    default: undefined
  },
  registrationFeeDate: {
    type: Date,
    default: null
  },
  registrationFeePhone: {
    type: String,
    default: null
  },
  registrationFeeTransactionId: {
    type: String,
    default: null
  },
  registrationFeePendingCheckoutId: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Indexes (memberId skipped — unique: true already creates it)
MemberSchema.index({ email: 1 });
MemberSchema.index({ status: 1 });
MemberSchema.index({ userId: 1 });
MemberSchema.index({ registrationFeePaid: 1 });
MemberSchema.index(
  { registrationFeeMpesaCode: 1 },
  {
    unique: true,
    partialFilterExpression: {
      registrationFeeMpesaCode: { $exists: true, $ne: null }
    }
  }
);
MemberSchema.index(
  { registrationFeePendingCheckoutId: 1 },
  {
    partialFilterExpression: {
      registrationFeePendingCheckoutId: { $exists: true, $ne: null }
    }
  }
);

export default mongoose.model<IMember>('Member', MemberSchema);
