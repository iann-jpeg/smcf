import mongoose, { Schema, Document } from 'mongoose';

export type FinancialAdjustmentTarget =
  | 'income_statement'
  | 'balance_sheet'
  | 'cash_flow_statement'
  | 'all';

export interface IFinancialStatementAdjustment extends Document {
  targetStatement: FinancialAdjustmentTarget;
  periodLabel: string;
  startDate: Date;
  endDate: Date;
  lineKey: string;
  category: string;
  amount: number;
  note: string;
  status: 'pending' | 'approved' | 'rejected';
  createdBy: Schema.Types.ObjectId;
  approvedBy: Schema.Types.ObjectId | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const FinancialStatementAdjustmentSchema = new Schema<IFinancialStatementAdjustment>(
  {
    targetStatement: {
      type: String,
      enum: ['income_statement', 'balance_sheet', 'cash_flow_statement', 'all'],
      required: true,
      index: true,
      default: 'all',
    },
    periodLabel: { type: String, required: true, index: true },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    lineKey: { type: String, required: true, index: true },
    category: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    note: { type: String, required: true, trim: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

FinancialStatementAdjustmentSchema.index({ targetStatement: 1, periodLabel: 1, status: 1 });

export default mongoose.model<IFinancialStatementAdjustment>('FinancialStatementAdjustment', FinancialStatementAdjustmentSchema);
