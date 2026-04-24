import mongoose, { Schema, Document } from 'mongoose';

export type DocumentType = 
  | 'share_capital_policy'
  | 'dividend_distribution_policy'
  | 'share_purchase_policy'
  | 'share_transfer_policy'
  | 'member_exit_policy'
  | 'reserve_fund_policy'
  | 'shareholder_register'
  | 'share_certificate'
  | 'dividend_statement'
  | 'sacco_share_summary_report'
  | 'annual_shareholder_report'
  | 'shareholder_onboarding_form'
  | 'constitution_clause'
  | 'board_resolution'
  | 'exit_settlement_letter'
  | 'daily_activity_report'
  | 'weekly_activity_report'
  | 'monthly_growth_report'
  | 'dividend_history_report'
  | 'reserve_movement_report'
  | 'exited_members_report'
  | 'capital_growth_report'
  | 'custom';

export interface IDocument extends Document {
  // Document Info
  documentType: DocumentType;
  title: string;
  description?: string;
  
  // File Storage
  fileName: string;
  fileFormat: 'pdf' | 'docx' | 'xlsx' | 'csv';
  filePath: string;                      // S3 URL or local path
  fileSize: number;                      // in bytes
  base64Data?: string;                   // For embedding in responses
  
  // Related Records
  relatedDividendId?: Schema.Types.ObjectId;
  relatedShareholderId?: Schema.Types.ObjectId;
  relatedReportPeriod?: {
    startDate: Date;
    endDate: Date;
  };
  
  // Version Control
  version: number;
  previousVersionId?: Schema.Types.ObjectId;
  
  // Access & Permissions
  visibility: 'admin_only' | 'download_available';
  downloadableByRoles: string[];         // e.g., ['admin', 'treasurer']
  
  // Generation Details
  generatedBy: Schema.Types.ObjectId;
  generatedAt: Date;
  
  // Archive Status
  isArchived: boolean;
  archivedAt?: Date;
  archivedBy?: Schema.Types.ObjectId;
  archivedReason?: string;
  
  // Audit
  downloadedTimes: number;
  lastDownloadedAt?: Date;
  lastDownloadedBy?: Schema.Types.ObjectId;
  
  createdAt: Date;
  updatedAt: Date;
}

const DocumentSchema = new Schema<IDocument>({
  documentType: {
    type: String,
    enum: [
      'share_capital_policy',
      'dividend_distribution_policy',
      'share_purchase_policy',
      'share_transfer_policy',
      'member_exit_policy',
      'reserve_fund_policy',
      'shareholder_register',
      'share_certificate',
      'dividend_statement',
      'sacco_share_summary_report',
      'annual_shareholder_report',
      'shareholder_onboarding_form',
      'constitution_clause',
      'board_resolution',
      'exit_settlement_letter',
      'daily_activity_report',
      'weekly_activity_report',
      'monthly_growth_report',
      'dividend_history_report',
      'reserve_movement_report',
      'exited_members_report',
      'capital_growth_report',
      'custom'
    ],
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    index: true
  },
  description: String,
  fileName: {
    type: String,
    required: true
  },
  fileFormat: {
    type: String,
    enum: ['pdf', 'docx', 'xlsx', 'csv'],
    required: true
  },
  filePath: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true,
    min: 0
  },
  base64Data: String,
  relatedDividendId: {
    type: Schema.Types.ObjectId,
    ref: 'Dividend'
  },
  relatedShareholderId: {
    type: Schema.Types.ObjectId,
    ref: 'Shareholder'
  },
  relatedReportPeriod: {
    startDate: Date,
    endDate: Date
  },
  version: {
    type: Number,
    default: 1,
    min: 1
  },
  previousVersionId: {
    type: Schema.Types.ObjectId,
    ref: 'Document'
  },
  visibility: {
    type: String,
    enum: ['admin_only', 'download_available'],
    default: 'admin_only'
  },
  downloadableByRoles: [{
    type: String,
    default: ['admin']
  }],
  generatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  generatedAt: {
    type: Date,
    default: Date.now,
    required: true,
    index: true
  },
  isArchived: {
    type: Boolean,
    default: false,
    index: true
  },
  archivedAt: Date,
  archivedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  archivedReason: String,
  downloadedTimes: {
    type: Number,
    default: 0,
    min: 0
  },
  lastDownloadedAt: Date,
  lastDownloadedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Indexes for common queries
DocumentSchema.index({ documentType: 1, createdAt: -1 });
DocumentSchema.index({ generatedAt: -1 });
DocumentSchema.index({ isArchived: 1 });
DocumentSchema.index({ title: 'text', description: 'text' });

export default mongoose.model<IDocument>('Document', DocumentSchema);
