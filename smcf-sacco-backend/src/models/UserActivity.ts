import mongoose, { Document, Schema } from 'mongoose';

export type UserActivityEvent =
  | 'login'
  | 'logout'
  | 'session_exit'
  | 'search'
  | 'page_view'
  | 'action';

export interface IUserActivity extends Document {
  userId: mongoose.Types.ObjectId | null;
  sessionId: string | null;
  event: UserActivityEvent;
  action: string;
  path: string | null;
  searchCategories: string[];
  resultCount: number | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

const schema = new Schema<IUserActivity>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  sessionId: { type: String, default: null, index: true },
  event: { type: String, enum: ['login', 'logout', 'session_exit', 'search', 'page_view', 'action'], required: true, index: true },
  action: { type: String, required: true, maxlength: 120 },
  path: { type: String, default: null, maxlength: 240 },
  searchCategories: { type: [String], default: [] },
  resultCount: { type: Number, default: null },
  metadata: { type: Schema.Types.Mixed, default: null },
  ipAddress: { type: String, default: null },
  userAgent: { type: String, default: null, maxlength: 500 },
  createdAt: { type: Date, default: Date.now, index: true },
}, { versionKey: false });

schema.index({ event: 1, createdAt: -1 });

export default mongoose.model<IUserActivity>('UserActivity', schema);
