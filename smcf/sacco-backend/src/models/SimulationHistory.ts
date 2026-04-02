import mongoose, { Schema, Document } from 'mongoose';

export interface ISimulationHistory extends Document {
  userId: mongoose.Types.ObjectId;
  mode: string;
  scenarioA: any;
  resultA: any;
  scenarioB: any | null;
  resultB: any | null;
  notes: string | null;
  createdAt: Date;
}

const SimulationHistorySchema = new Schema<ISimulationHistory>({
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  mode: { 
    type: String, 
    default: 'single' 
  },
  scenarioA: { 
    type: Schema.Types.Mixed, 
    required: true 
  },
  resultA: { 
    type: Schema.Types.Mixed, 
    required: true 
  },
  scenarioB: { 
    type: Schema.Types.Mixed, 
    default: null 
  },
  resultB: { 
    type: Schema.Types.Mixed, 
    default: null 
  },
  notes: { 
    type: String, 
    default: null 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Indexes
SimulationHistorySchema.index({ userId: 1 });
SimulationHistorySchema.index({ createdAt: -1 });

export default mongoose.model<ISimulationHistory>('SimulationHistory', SimulationHistorySchema);
