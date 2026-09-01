import mongoose from 'mongoose';

const patientSchema = new mongoose.Schema({
  abhaId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  age: { type: Number, required: true },
  gender: { type: String, required: true },
  village: { type: String, required: true },
  category: { type: String, default: 'General' },
  severity: { 
    type: String, 
    enum: ['LOW_GREEN', 'MODERATE_YELLOW', 'CRITICAL_RED'], 
    default: 'LOW_GREEN' 
  },
  lastVitals: {
    bp: { type: String, default: '120/80' },
    pulse: { type: Number, default: 75 },
    spO2: { type: Number, default: 98 }
  }
}, { timestamps: true });

export default mongoose.model('Patient', patientSchema);