import mongoose, { Document, Schema } from 'mongoose';

export interface ITenXAuditLog extends Document {
  admin_id: mongoose.Types.ObjectId;
  action: string;
  member_id?: mongoose.Types.ObjectId;
  contribution_id?: mongoose.Types.ObjectId;
  description: string;
}

const schema = new Schema<ITenXAuditLog>({
  admin_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true },
  member_id: { type: Schema.Types.ObjectId, ref: 'Member' },
  contribution_id: { type: Schema.Types.ObjectId, ref: 'TenXContribution' },
  description: { type: String, required: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

export default mongoose.model<ITenXAuditLog>('TenXAuditLog', schema, 'tenxauditlogs');
