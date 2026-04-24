import mongoose, { Schema, Document } from 'mongoose';

export interface ISimulationPreset extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  description: string | null;
  icon: string;
  amount: number;
  guarantorCount: number;
  overrideTrust: number | null;
  sortOrder: number;
  createdAt: Date;
}

const SimulationPresetSchema = new Schema<ISimulationPreset>({
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  name: { 
    type: String, 
    required: true 
  },
  description: { 
    type: String, 
    default: null 
  },
  icon: { 
    type: String, 
    default: '💰' 
  },
  amount: { 
    type: Number, 
    default: 0 
  },
  guarantorCount: { 
    type: Number, 
    default: 0 
  },
  overrideTrust: { 
    type: Number, 
    default: null 
  },
  sortOrder: { 
    type: Number, 
    default: 0 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Indexes
SimulationPresetSchema.index({ userId: 1 });
SimulationPresetSchema.index({ sortOrder: 1 });

export default mongoose.model<ISimulationPreset>('SimulationPreset', SimulationPresetSchema);
