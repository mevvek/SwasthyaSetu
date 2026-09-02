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

    // Real-time broadcast for new patient creation
    if (req.io) {
      req.io.emit('patient_queue_updated', newPatient);
    }

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

    // Real-time broadcast for patient updates
    if (req.io) {
      req.io.emit('patient_queue_updated', updated);
    }

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

    await TriageRecord.deleteMany({ patientId: req.params.id });
    await Prescription.deleteMany({ patientId: req.params.id });

    // Real-time broadcast for patient removal
    if (req.io) {
      req.io.emit('patient_deleted', req.params.id);
    }

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

    // ⚡ REAL-TIME WEBSOCKET BROADCAST
    if (req.io && updatedPatient) {
      req.io.emit('patient_queue_updated', updatedPatient);

      // Trigger high-priority alert across all connected portals
      if (triageResult.severity === 'CRITICAL_RED') {
        req.io.emit('critical_emergency_alert', {
          patientId: updatedPatient._id,
          name: updatedPatient.name,
          age: updatedPatient.age,
          gender: updatedPatient.gender,
          village: updatedPatient.village,
          category: updatedPatient.category,
          vitals: updatedPatient.lastVitals,
          redFlags: triageResult.redFlags,
          timestamp: new Date().toISOString()
        });
      }
    }

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

    // Mark patient as LOW_GREEN once treated
    const updatedPatient = await Patient.findByIdAndUpdate(
      patientId,
      { severity: 'LOW_GREEN' },
      { new: true }
    );

    // Notify queue update via WebSocket
    if (req.io && updatedPatient) {
      req.io.emit('patient_queue_updated', updatedPatient);
    }

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

    // Broadcast inventory update
    if (req.io) {
      req.io.emit('inventory_updated', drug);
    }

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

    if (req.io) {
      req.io.emit('sync_completed_refresh');
    }

    res.json({ message: 'Sync completed successfully', count: patients.length + triageRecords.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};