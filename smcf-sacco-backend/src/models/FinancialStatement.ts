import mongoose, { Schema, Document } from 'mongoose';

export type FinancialStatementType = 'income_statement' | 'balance_sheet' | 'cash_flow_statement' | 'report_pack';
export type FinancialStatementStatus = 'draft' | 'approved' | 'locked';

export interface IFinancialStatement extends Document {
  statementType: FinancialStatementType;
  periodType: 'monthly' | 'quarterly' | 'yearly' | 'custom';
  periodLabel: string;
  startDate: Date;
  endDate: Date;
  version: number;
  status: FinancialStatementStatus;
  isValid: boolean;
  validationWarnings: string[];
  overrideUsed: boolean;
  lockedAt: Date | null;
  lockedBy: Schema.Types.ObjectId | null;
  approvedAt: Date | null;
  approvedBy: Schema.Types.ObjectId | null;
  generatedBy: Schema.Types.ObjectId;
  generatedAt: Date;
  notesToAccounts: string | null;
  lines: Record<string, any>;
  summary: Record<string, any>;
  comparison: Record<string, any> | null;
  trend: any;
  adjustmentsApplied: Schema.Types.ObjectId[];
  pdfMeta: {
    fileName: string | null;
    generatedAt: Date | null;
  };
  createdAt: Date;
  updatedAt: Date;
}

const FinancialStatementSchema = new Schema<IFinancialStatement>(
  {
    statementType: {
      type: String,
      enum: ['income_statement', 'balance_sheet', 'cash_flow_statement', 'report_pack'],
      required: true,
      index: true,
    },
    periodType: {
      type: String,
      enum: ['monthly', 'quarterly', 'yearly', 'custom'],
      required: true,
      index: true,
    },
    periodLabel: { type: String, required: true, index: true },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    version: { type: Number, required: true, default: 1 },
    status: { type: String, enum: ['draft', 'approved', 'locked'], default: 'draft', index: true },
    isValid: { type: Boolean, default: true },
    validationWarnings: { type: [String], default: [] },
    overrideUsed: { type: Boolean, default: false },
    lockedAt: { type: Date, default: null },
    lockedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    generatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    generatedAt: { type: Date, default: Date.now, index: true },
    notesToAccounts: { type: String, default: null },
    lines: { type: Schema.Types.Mixed, default: {} },
    summary: { type: Schema.Types.Mixed, default: {} },
    comparison: { type: Schema.Types.Mixed, default: null },
    trend: { type: Schema.Types.Mixed, default: [] },
    adjustmentsApplied: { type: [{ type: Schema.Types.ObjectId, ref: 'FinancialStatementAdjustment' }], default: [] },
    pdfMeta: {
      fileName: { type: String, default: null },
      generatedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

FinancialStatementSchema.index({ statementType: 1, periodLabel: 1, version: -1 }, { unique: true });
FinancialStatementSchema.index({ statementType: 1, startDate: 1, endDate: 1 });

export default mongoose.model<IFinancialStatement>('FinancialStatement', FinancialStatementSchema);
