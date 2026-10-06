import mongoose, { Document, Schema } from 'mongoose';

export type FinancialCalendarEventType =
  | 'cycle_payment'
  | 'loan_repayment'
  | 'card_payment'
  | 'wallet_maturity'
  | 'meeting'
  | 'notice';

export interface IFinancialCalendarEvent extends Document {
  title: string;
  description: string | null;
  type: FinancialCalendarEventType;
  startsAt: Date;
  endsAt: Date | null;
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
    type: {
      type: String,
      enum: ['cycle_payment', 'loan_repayment', 'card_payment', 'wallet_maturity', 'meeting', 'notice'],
      required: true,
    },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, default: null },
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
