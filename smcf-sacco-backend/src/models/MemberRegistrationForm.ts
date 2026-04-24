import mongoose, { Schema, Document } from 'mongoose';

export type RegistrationReviewStatus = 'submitted' | 'under_review' | 'approved' | 'rejected';

export interface IMemberRegistrationForm extends Document {
  member: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  saccoMemberId: string;
  memberName: string;
  status: RegistrationReviewStatus;
  submittedAt: Date;
  termsAccepted: boolean;
  passportPhoto: string | null;
  form: {
    personalDetails: {
      fullName: string;
      nationalIdOrPassportNo: string;
      dateOfBirth: string;
      gender: string;
      maritalStatus: string;
      nationality: string;
      placeOfBirth: string;
    };
    residentialAddress: {
      physicalAddress: string;
      townCity: string;
      county: string;
      country: string;
      poBox: string;
      postalCode: string;
    };
    contactInformation: {
      primaryMobileMpesa: string;
      alternativePhone: string;
      emailAddress: string;
    };
    employmentBusinessDetails: {
      occupationJobTitle: string;
      monthlyGrossIncomeKes: string;
      employerBusinessName: string;
      workPhoneNo: string;
      employmentStatus: string;
      sourceOfFunds: string;
    };
    bankingDetails: {
      bankName: string;
      branchName: string;
      accountNumber: string;
    };
    shareSubscriptionSavings: {
      noOfSharesSubscribed: string;
      totalShareCapitalKes: string;
      initialSavingsDepositKes: string;
    };
    nextOfKinBeneficiary: {
      fullName: string;
      relationship: string;
      phoneNumber: string;
      nationalIdNo: string;
      physicalAddress: string;
      emailIfAny: string;
    };
    declarationSignature: {
      acceptedAt: Date;
      applicantSignatureName: string;
      dateSigned: string;
    };
  };
  reviewedBy: mongoose.Types.ObjectId | null;
  reviewedAt: Date | null;
  reviewNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const MemberRegistrationFormSchema = new Schema<IMemberRegistrationForm>(
  {
    member: { type: Schema.Types.ObjectId, ref: 'Member', required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    saccoMemberId: { type: String, required: true, index: true },
    memberName: { type: String, required: true },
    status: {
      type: String,
      enum: ['submitted', 'under_review', 'approved', 'rejected'],
      default: 'submitted',
      index: true,
    },
    submittedAt: { type: Date, required: true, default: Date.now, index: true },
    termsAccepted: { type: Boolean, required: true, default: false },
    passportPhoto: { type: String, default: null },
    form: {
      personalDetails: {
        fullName: { type: String, required: true, trim: true },
        nationalIdOrPassportNo: { type: String, required: true, trim: true },
        dateOfBirth: { type: String, required: true, trim: true },
        gender: { type: String, required: true, trim: true },
        maritalStatus: { type: String, required: true, trim: true },
        nationality: { type: String, required: true, trim: true },
        placeOfBirth: { type: String, required: true, trim: true },
      },
      residentialAddress: {
        physicalAddress: { type: String, required: true, trim: true },
        townCity: { type: String, required: true, trim: true },
        county: { type: String, required: true, trim: true },
        country: { type: String, required: true, trim: true },
        poBox: { type: String, required: true, trim: true },
        postalCode: { type: String, required: true, trim: true },
      },
      contactInformation: {
        primaryMobileMpesa: { type: String, required: true, trim: true },
        alternativePhone: { type: String, required: true, trim: true },
        emailAddress: { type: String, required: true, trim: true, lowercase: true },
      },
      employmentBusinessDetails: {
        occupationJobTitle: { type: String, required: true, trim: true },
        monthlyGrossIncomeKes: { type: String, required: true, trim: true },
        employerBusinessName: { type: String, required: true, trim: true },
        workPhoneNo: { type: String, required: true, trim: true },
        employmentStatus: { type: String, required: true, trim: true },
        sourceOfFunds: { type: String, required: true, trim: true },
      },
      bankingDetails: {
        bankName: { type: String, required: true, trim: true },
        branchName: { type: String, required: true, trim: true },
        accountNumber: { type: String, required: true, trim: true },
      },
      shareSubscriptionSavings: {
        noOfSharesSubscribed: { type: String, required: true, trim: true },
        totalShareCapitalKes: { type: String, required: true, trim: true },
        initialSavingsDepositKes: { type: String, required: true, trim: true },
      },
      nextOfKinBeneficiary: {
        fullName: { type: String, required: true, trim: true },
        relationship: { type: String, required: true, trim: true },
        phoneNumber: { type: String, required: true, trim: true },
        nationalIdNo: { type: String, required: true, trim: true },
        physicalAddress: { type: String, required: true, trim: true },
        emailIfAny: { type: String, required: true, trim: true, lowercase: true },
      },
      declarationSignature: {
        acceptedAt: { type: Date, required: true },
        applicantSignatureName: { type: String, required: true, trim: true },
        dateSigned: { type: String, required: true, trim: true },
      },
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    reviewNotes: { type: String, default: null },
  },
  { timestamps: true }
);

MemberRegistrationFormSchema.index({ userId: 1, submittedAt: -1 });
MemberRegistrationFormSchema.index({ memberName: 1 });

export default mongoose.model<IMemberRegistrationForm>('MemberRegistrationForm', MemberRegistrationFormSchema);
