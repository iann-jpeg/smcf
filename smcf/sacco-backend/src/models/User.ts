import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  password: string;
  fullName: string | null;
  avatarUrl: string | null;
  roles: ('admin' | 'credit_officer' | 'credit_committee' | 'treasurer' | 'auditor' | 'member')[];
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    trim: true 
  },
  password: { 
    type: String, 
    required: true,
    select: false 
  },
  fullName: { 
    type: String, 
    default: null 
  },
  avatarUrl: { 
    type: String, 
    default: null 
  },
  roles: [{
    type: String,
    enum: ['admin', 'credit_officer', 'credit_committee', 'treasurer', 'auditor', 'member'],
    default: 'member'
  }],
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String,
    select: false
  },
  emailVerificationExpires: {
    type: Date,
    select: false
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: true
});

export default mongoose.model<IUser>('User', UserSchema);
