import mongoose from 'mongoose';

const triageSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  systolicBP: Number,
  diastolicBP: Number,
  pulseRate: Number,
  spO2: Number,
  temperature: Number,
  respiratoryRate: Number,
  symptomsText: String,
  severity: { type: String, default: 'LOW_GREEN' },
  redFlags: [String],
  recommendations: [String],
  assessedAt: { type: Date, default: Date.now }
});

export default mongoose.model('TriageRecord', triageSchema);