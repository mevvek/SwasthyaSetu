import mongoose from 'mongoose';

const drugSchema = new mongoose.Schema({
  name: { type: String, required: true },
  stock: { type: Number, required: true },
  minThreshold: { type: Number, required: true },
  unit: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['NORMAL', 'LOW_STOCK', 'CRITICAL'], 
    default: 'NORMAL' 
  }
}, { timestamps: true });

export default mongoose.model('DrugInventory', drugSchema);