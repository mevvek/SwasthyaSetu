import mongoose from 'mongoose';

const prescriptionSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  patientName: String,
  doctorName: String,
  diagnosis: { type: String, required: true },
  medicines: { type: String, required: true },
  advice: String,
  signedAt: { type: Date, default: Date.now }
});

export default mongoose.model('Prescription', prescriptionSchema);