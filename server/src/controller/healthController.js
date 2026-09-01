import Patient from '../models/Patient.js';
import TriageRecord from '../models/TriageRecord.js';
import Prescription from '../models/Prescription.js';
import DrugInventory from '../models/DrugInventory.js';

// --- PATIENTS ---
export const getPatients = async (req, res) => {
  try {
    const patients = await Patient.find().sort({ createdAt: -1 });
    res.json(patients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createPatient = async (req, res) => {
  try {
    const { name, age, gender, village, category, severity, lastVitals } = req.body;
    const r = () => Math.floor(1000 + Math.random() * 9000);
    const abhaId = req.body.abhaId || `91-${r()}-${r()}-${r()}`;

    const newPatient = await Patient.create({
      abhaId,
      name,
      age,
      gender,
      village,
      category: category || 'General',
      severity: severity || 'LOW_GREEN',
      lastVitals: lastVitals || { bp: '120/80', pulse: 75, spO2: 98 }
    });

    res.status(201).json(newPatient);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update Patient Details
export const updatePatient = async (req, res) => {
  try {
    const updated = await Patient.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Patient not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete / Discharge Patient
export const deletePatient = async (req, res) => {
  try {
    const deleted = await Patient.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Patient not found' });
    
    // Clean up related triage & prescriptions
    await TriageRecord.deleteMany({ patientId: req.params.id });
    await Prescription.deleteMany({ patientId: req.params.id });

    res.json({ message: 'Patient removed from registry successfully', id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// --- TRIAGE ---
export const saveTriageAssessment = async (req, res) => {
  try {
    const { patientId, vitals, triageResult } = req.body;

    const triageDoc = await TriageRecord.create({
      patientId,
      systolicBP: Number(vitals.systolicBP),
      diastolicBP: Number(vitals.diastolicBP),
      pulseRate: Number(vitals.pulseRate),
      spO2: Number(vitals.spO2),
      temperature: Number(vitals.temperature),
      respiratoryRate: Number(vitals.respiratoryRate),
      symptomsText: vitals.symptomsText,
      severity: triageResult.severity,
      redFlags: triageResult.redFlags,
      recommendations: triageResult.recommendations
    });

    const updatedPatient = await Patient.findByIdAndUpdate(
      patientId,
      {
        severity: triageResult.severity,
        lastVitals: {
          bp: `${vitals.systolicBP}/${vitals.diastolicBP}`,
          pulse: Number(vitals.pulseRate),
          spO2: Number(vitals.spO2)
        }
      },
      { new: true }
    );

    res.status(201).json({ triageDoc, updatedPatient });
  } catch (err) {
    console.error('Triage Save Error:', err);
    res.status(500).json({ error: err.message });
  }
};

// --- PRESCRIPTIONS ---
export const createPrescription = async (req, res) => {
  try {
    const { patientId, patientName, doctorName, diagnosis, medicines, advice } = req.body;
    const rx = await Prescription.create({
      patientId,
      patientName,
      doctorName,
      diagnosis,
      medicines,
      advice
    });

    // Automatically mark patient as treated / NORMAL LOW_GREEN
    await Patient.findByIdAndUpdate(patientId, {
      severity: 'LOW_GREEN'
    });

    res.status(201).json(rx);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getPrescriptions = async (req, res) => {
  try {
    const rxList = await Prescription.find().sort({ signedAt: -1 });
    res.json(rxList);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// --- INVENTORY ---
export const getInventory = async (req, res) => {
  try {
    const inventory = await DrugInventory.find();
    res.json(inventory);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const replenishDrug = async (req, res) => {
  try {
    const drug = await DrugInventory.findById(req.params.id);
    if (!drug) return res.status(404).json({ error: 'Drug not found' });

    drug.stock += 200;
    drug.status = 'NORMAL';
    await drug.save();

    res.json(drug);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// --- BULK OFFLINE SYNC ---
export const syncBulkData = async (req, res) => {
  try {
    const { patients = [], triageRecords = [] } = req.body;

    for (const p of patients) {
      await Patient.findOneAndUpdate(
        { abhaId: p.abhaId },
        { ...p },
        { upsert: true, new: true }
      );
    }

    for (const t of triageRecords) {
      await TriageRecord.create(t);
    }

    res.json({ message: 'Sync completed successfully', count: patients.length + triageRecords.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};