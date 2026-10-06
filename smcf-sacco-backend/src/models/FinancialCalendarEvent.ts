import mongoose, { Document, Schema } from 'mongoose';

export type FinancialCalendarEventType =
  | 'general'
  | 'cycle'
  | 'savings'
  | 'wallet'
  | 'loans'
  | 'shares'
  | 'ten_x'
  | 'training'
  | 'financial_literacy'
  | 'community'
  | 'recruitment'
  | 'youth'
  | 'deadline'
  | 'announcement'
  | 'other'
  | 'cycle_payment'
  | 'loan_repayment'
  | 'card_payment'
  | 'wallet_maturity'
  | 'meeting'
  | 'notice';

export interface IFinancialCalendarEvent extends Document {
  title: string;
  description: string | null;
  fullDescription: string | null;
  type: FinancialCalendarEventType;
  startsAt: Date;
  endsAt: Date | null;
  venue: string | null;
  organizer: string | null;
  contact: string | null;
  registrationLink: string | null;
  externalLink: string | null;
  imageUrl: string | null;
  status: 'draft' | 'published' | 'unpublished' | 'cancelled' | 'completed';
  priority: 'low' | 'normal' | 'high';
  amount: number | null;
  memberIds: mongoose.Types.ObjectId[];
  isPublic: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const FinancialCalendarEventSchema = new Schema<IFinancialCalendarEvent>(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, default: null, maxlength: 1000 },
    fullDescription: { type: String, default: null, maxlength: 5000 },
    type: {
      type: String,
      enum: [
        'general', 'cycle', 'savings', 'wallet', 'loans', 'shares', 'ten_x', 'training',
        'financial_literacy', 'community', 'recruitment', 'youth', 'deadline', 'announcement',
        'other', 'cycle_payment', 'loan_repayment', 'card_payment', 'wallet_maturity', 'meeting', 'notice',
      ],
      required: true,
    },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, default: null },
    venue: { type: String, default: null, maxlength: 240 },
    organizer: { type: String, default: null, maxlength: 160 },
    contact: { type: String, default: null, maxlength: 240 },
    registrationLink: { type: String, default: null, maxlength: 500 },
    externalLink: { type: String, default: null, maxlength: 500 },
    imageUrl: { type: String, default: null, maxlength: 1000 },
    status: {
      type: String,
      enum: ['draft', 'published', 'unpublished', 'cancelled', 'completed'],
      default: 'draft',
    },
    priority: { type: String, enum: ['low', 'normal', 'high'], default: 'normal' },
    amount: { type: Number, default: null, min: 0 },
    memberIds: [{ type: Schema.Types.ObjectId, ref: 'Member' }],
    isPublic: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

FinancialCalendarEventSchema.index({ startsAt: 1, isPublic: 1 });
FinancialCalendarEventSchema.index({ memberIds: 1, startsAt: 1 });

export default mongoose.model<IFinancialCalendarEvent>('FinancialCalendarEvent', FinancialCalendarEventSchema);
