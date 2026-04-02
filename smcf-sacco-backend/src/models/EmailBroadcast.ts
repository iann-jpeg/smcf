import mongoose, { Schema, Document } from 'mongoose';

interface IRecipientFilters {
  staffOnly: boolean;
  activeMembersOnly: boolean;
  verifiedUsersOnly: boolean;
}

interface IRecipientStats {
  fromUsers: number;
  fromMembers: number;
  dedupedTotal: number;
  maxRecipients: number;
  skippedByCap: number;
  attempted: number;
}

interface IDeliveryStats {
  sent: number;
  failed: number;
  sampleFailures: Array<{ email: string; error: string }>;
}

export interface IEmailBroadcast extends Document {
  createdBy: mongoose.Types.ObjectId | null;
  subject: string;
  messagePreview: string;
  isHtml: boolean;
  templateMode: 'plain' | 'branded';
  filters: IRecipientFilters;
  recipients: IRecipientStats;
  delivery: IDeliveryStats;
  createdAt: Date;
  updatedAt: Date;
}

const EmailBroadcastSchema = new Schema<IEmailBroadcast>(
  {
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    messagePreview: {
      type: String,
      required: true,
      trim: true,
    },
    isHtml: {
      type: Boolean,
      default: false,
    },
    templateMode: {
      type: String,
      enum: ['plain', 'branded'],
      default: 'plain',
    },
    filters: {
      staffOnly: { type: Boolean, default: false },
      activeMembersOnly: { type: Boolean, default: false },
      verifiedUsersOnly: { type: Boolean, default: false },
    },
    recipients: {
      fromUsers: { type: Number, default: 0 },
      fromMembers: { type: Number, default: 0 },
      dedupedTotal: { type: Number, default: 0 },
      maxRecipients: { type: Number, default: 0 },
      skippedByCap: { type: Number, default: 0 },
      attempted: { type: Number, default: 0 },
    },
    delivery: {
      sent: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      sampleFailures: {
        type: [
          {
            email: { type: String, required: true },
            error: { type: String, required: true },
          },
        ],
        default: [],
      },
    },
  },
  { timestamps: true }
);

EmailBroadcastSchema.index({ createdAt: -1 });
EmailBroadcastSchema.index({ createdBy: 1, createdAt: -1 });

export default mongoose.model<IEmailBroadcast>('EmailBroadcast', EmailBroadcastSchema);
