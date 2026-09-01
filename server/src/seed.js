import 'dotenv/config';
import mongoose from 'mongoose';
import Patient from './models/Patient.js';
import DrugInventory from './models/DrugInventory.js';

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB Atlas for Seeding...');

    await Patient.deleteMany({});
    await DrugInventory.deleteMany({});

    await Patient.insertMany([
      {
        abhaId: '91-4521-8890-1234',
        name: 'Radha Devi',
        age: 28,
        gender: 'Female',
        village: 'Kunda Village',
        category: 'Maternal (High Risk)',
        severity: 'CRITICAL_RED',
        lastVitals: { bp: '145/95', pulse: 92, spO2: 96 }
      },
      {
        abhaId: '91-7890-3341-5521',
        name: 'Ramesh Kumar',
        age: 54,
        gender: 'Male',
        village: 'Rampur',
        category: 'Diabetic',
        severity: 'MODERATE_YELLOW',
        lastVitals: { bp: '130/85', pulse: 76, spO2: 98 }
      },
      {
        abhaId: '91-1122-4455-6677',
        name: 'Aarav (Infant)',
        age: 2,
        gender: 'Male',
        village: 'Kunda Village',
        category: 'Pediatric Care',
        severity: 'LOW_GREEN',
        lastVitals: { bp: '95/60', pulse: 105, spO2: 99 }
      }
    ]);

    await DrugInventory.insertMany([
      { name: 'Paracetamol 500mg (Tablets)', stock: 3500, minThreshold: 1000, status: 'NORMAL', unit: 'strips' },
      { name: 'Oxytocin 10 IU Injection', stock: 12, minThreshold: 50, status: 'CRITICAL', unit: 'vials' },
      { name: 'Oral Rehydration Salts (ORS)', stock: 65, minThreshold: 200, status: 'LOW_STOCK', unit: 'packets' },
      { name: 'Magnesium Sulphate 50% Inj', stock: 8, minThreshold: 30, status: 'CRITICAL', unit: 'vials' },
      { name: 'Amoxicillin 250mg Suspension', stock: 450, minThreshold: 100, status: 'NORMAL', unit: 'bottles' }
    ]);

    console.log('🌱 MongoDB Atlas Seeded Successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

seedDB();