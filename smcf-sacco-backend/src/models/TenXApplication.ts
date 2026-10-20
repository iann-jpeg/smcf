import mongoose, { Document, Schema } from 'mongoose';

export type TenXApplicationStatus =
  | 'Submitted'
  | 'Under Review'
  | 'Additional Information Required'
  | 'Approved'
  | 'Rejected'
  | 'Withdrawn';

export interface ITenXApplicationHistory {
  status: TenXApplicationStatus;
  note?: string;
  changedBy?: mongoose.Types.ObjectId;
  changedAt: Date;
}

export interface ITenXApplication extends Document {
  referenceNumber: string;
  applicantUserId?: mongoose.Types.ObjectId | null;
  memberId: mongoose.Types.ObjectId;
  fullName: string;
  phone: string;
  email?: string | null;
  membershipStatus: string;
  eligibilityConfirmed: boolean;
  purposeAcknowledged: boolean;
  termsAcknowledged: boolean;
  consentAt: Date;
  reason: string;
  eligibilitySnapshot: Record<string, unknown>;
  status: TenXApplicationStatus;
  decisionNote?: string | null;
  decidedBy?: mongoose.Types.ObjectId | null;
  decidedAt?: Date | null;
  history: ITenXApplicationHistory[];
  createdAt: Date;
  updatedAt: Date;
}

const historySchema = new Schema<ITenXApplicationHistory>({
  status: { type: String, required: true },
  note: { type: String, trim: true },
  changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  changedAt: { type: Date, default: Date.now },
}, { _id: false });

const schema = new Schema<ITenXApplication>({
  referenceNumber: { type: String, required: true, unique: true, index: true },
  applicantUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  memberId: { type: Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
  fullName: { type: String, required: true, trim: true, maxlength: 120 },
  phone: { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true, default: null },
  membershipStatus: { type: String, required: true },
  eligibilityConfirmed: { type: Boolean, required: true },
  purposeAcknowledged: { type: Boolean, required: true },
  termsAcknowledged: { type: Boolean, required: true },
  consentAt: { type: Date, required: true },
  reason: { type: String, required: true, trim: true, maxlength: 1000 },
  eligibilitySnapshot: { type: Schema.Types.Mixed, required: true },
  status: { type: String, enum: ['Submitted', 'Under Review', 'Additional Information Required', 'Approved', 'Rejected', 'Withdrawn'], default: 'Submitted', index: true },
  decisionNote: { type: String, trim: true, maxlength: 1000, default: null },
  decidedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  decidedAt: { type: Date, default: null },
  history: { type: [historySchema], default: [] },
}, { timestamps: true });

schema.index({ memberId: 1, status: 1 });
schema.index({ createdAt: -1 });

export default mongoose.model<ITenXApplication>('TenXApplication', schema, 'tenxapplications');
