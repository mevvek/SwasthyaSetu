import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['ASHA_WORKER', 'DOCTOR', 'ADMIN'], 
    default: 'ASHA_WORKER' 
  },
  phcCenter: { type: String, default: 'PHC Kunda Hub' }
}, { timestamps: true });

export default mongoose.model('User', userSchema);