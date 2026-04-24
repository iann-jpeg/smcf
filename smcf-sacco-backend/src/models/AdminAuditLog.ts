import mongoose, { Schema, Document } from 'mongoose';

export type AuditAction = 
  | 'shareholder_created'
  | 'shareholder_updated'
  | 'shareholder_status_changed'
  | 'shareholder_kyc_verified'
  | 'shareholder_exited'
  | 'share_transaction_created'
  | 'share_transaction_approved'
  | 'share_transaction_rejected'
  | 'dividend_created'
  | 'dividend_approved'
  | 'dividend_distributed'
  | 'dividend_statement_generated'
  | 'reserve_fund_transaction_created'
  | 'reserve_fund_transaction_approved'
  | 'reserve_fund_transaction_rejected'
  | 'document_generated'
  | 'document_downloaded'
  | 'document_archived'
  | 'settings_updated'
  | 'policy_text_updated'
  | 'report_generated'
  | 'audit_log_viewed';

export interface IAdminAuditLog extends Document {
  // Admin Info
  adminId: Schema.Types.ObjectId;
  adminEmail: string;
  
  // Action Info
  action: AuditAction;
  module: 'shareholders' | 'shares' | 'dividends' | 'reserves' | 'documents' | 'settings' | 'reports';
  
  // Related Records
  relatedRecordType?: string;            // 'Shareholder', 'Dividend', etc.
  relatedRecordId?: Schema.Types.ObjectId;
  relatedRecordName?: string;
  
  // Details
  description: string;
  changes?: {
    field: string;
    beforeValue: any;
    afterValue: any;
  }[];
  
  // System Info
  ipAddress?: string;
  userAgent?: string;
  device?: string;
  
  // Status
  status: 'success' | 'failure';
  failureReason?: string;
  
  // Sensitive Flag
  isSensitive: boolean;                  // True for critical actions
  
  // Audit
  createdAt: Date;
}

const AdminAuditLogSchema = new Schema<IAdminAuditLog>({
  adminId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  adminEmail: {
    type: String,
    required: true,
    index: true
  },
  action: {
    type: String,
    enum: [
      'shareholder_created',
      'shareholder_updated',
      'shareholder_status_changed',
      'shareholder_kyc_verified',
      'shareholder_exited',
      'share_transaction_created',
      'share_transaction_approved',
      'share_transaction_rejected',
      'dividend_created',
      'dividend_approved',
      'dividend_distributed',
      'dividend_statement_generated',
      'reserve_fund_transaction_created',
      'reserve_fund_transaction_approved',
      'reserve_fund_transaction_rejected',
      'document_generated',
      'document_downloaded',
      'document_archived',
      'settings_updated',
      'policy_text_updated',
      'report_generated',
      'audit_log_viewed'
    ],
    required: true,
    index: true
  },
  module: {
    type: String,
    enum: ['shareholders', 'shares', 'dividends', 'reserves', 'documents', 'settings', 'reports'],
    required: true,
    index: true
  },
  relatedRecordType: String,
  relatedRecordId: {
    type: Schema.Types.ObjectId,
    index: true
  },
  relatedRecordName: String,
  description: {
    type: String,
    required: true
  },
  changes: [{
    field: String,
    beforeValue: Schema.Types.Mixed,
    afterValue: Schema.Types.Mixed
  }],
  ipAddress: String,
  userAgent: String,
  device: String,
  status: {
    type: String,
    enum: ['success', 'failure'],
    default: 'success'
  },
  failureReason: String,
  isSensitive: {
    type: Boolean,
    default: false,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, { 
  timestamps: false  // Only use createdAt for audit logs
});

// Indexes for audit log queries
AdminAuditLogSchema.index({ adminId: 1, createdAt: -1 });
AdminAuditLogSchema.index({ action: 1, createdAt: -1 });
AdminAuditLogSchema.index({ module: 1, createdAt: -1 });
AdminAuditLogSchema.index({ relatedRecordId: 1 });
AdminAuditLogSchema.index({ createdAt: -1 });

// TTL Index - Keep audit logs for 3 years then auto-delete
AdminAuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 94608000 }); // 3 years

export default mongoose.model<IAdminAuditLog>('AdminAuditLog', AdminAuditLogSchema);
