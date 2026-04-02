import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  userId: mongoose.Types.ObjectId | null;
  tableName: string;
  recordId: string | null;
  action: string;
  changes: any;
  ipAddress: string | null;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User',
    default: null 
  },
  tableName: { 
    type: String, 
    required: true 
  },
  recordId: { 
    type: String, 
    default: null 
  },
  action: { 
    type: String, 
    required: true 
  },
  changes: { 
    type: Schema.Types.Mixed, 
    default: null 
  },
  ipAddress: { 
    type: String, 
    default: null 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Indexes
AuditLogSchema.index({ userId: 1 });
AuditLogSchema.index({ tableName: 1 });
AuditLogSchema.index({ createdAt: -1 });

export default mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
