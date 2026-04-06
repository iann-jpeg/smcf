import mongoose, { Schema, Document } from 'mongoose';

export interface IMemberMessage extends Document {
  source: 'member-dashboard' | 'members-section' | 'landing-page';
  senderUserId: mongoose.Types.ObjectId | null;
  senderName: string;
  senderContact: string;
  subject: string;
  message: string;
  status: 'new' | 'read';
  readBy: mongoose.Types.ObjectId | null;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const MemberMessageSchema = new Schema<IMemberMessage>(
  {
    source: {
      type: String,
      enum: ['member-dashboard', 'members-section', 'landing-page'],
      default: 'member-dashboard',
    },
    senderUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    senderName: {
      type: String,
      required: true,
      trim: true,
    },
    senderContact: {
      type: String,
      default: '',
      trim: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['new', 'read'],
      default: 'new',
    },
    readBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

MemberMessageSchema.index({ createdAt: -1 });
MemberMessageSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model<IMemberMessage>('MemberMessage', MemberMessageSchema);
