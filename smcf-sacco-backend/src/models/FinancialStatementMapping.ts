import mongoose, { Schema, Document } from 'mongoose';

export interface IFinancialStatementMapping extends Document {
  sourceType: string;
  sourceKey: string;
  incomeLineKey: string | null;
  balanceSheetLineKey: string | null;
  cashFlowLineKey: string | null;
  cashFlowBucket: 'operating' | 'investing' | 'financing' | null;
  direction: 'inflow' | 'outflow' | 'neutral';
  isActive: boolean;
  updatedBy: Schema.Types.ObjectId | null;
  updatedAt: Date;
  createdAt: Date;
}

const FinancialStatementMappingSchema = new Schema<IFinancialStatementMapping>(
  {
    sourceType: { type: String, required: true, index: true },
    sourceKey: { type: String, required: true, index: true },
    incomeLineKey: { type: String, default: null },
    balanceSheetLineKey: { type: String, default: null },
    cashFlowLineKey: { type: String, default: null },
    cashFlowBucket: {
      type: String,
      enum: ['operating', 'investing', 'financing', null],
      default: null,
    },
    direction: {
      type: String,
      enum: ['inflow', 'outflow', 'neutral'],
      default: 'neutral',
    },
    isActive: { type: Boolean, default: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

FinancialStatementMappingSchema.index({ sourceType: 1, sourceKey: 1 }, { unique: true });

export default mongoose.model<IFinancialStatementMapping>('FinancialStatementMapping', FinancialStatementMappingSchema);
