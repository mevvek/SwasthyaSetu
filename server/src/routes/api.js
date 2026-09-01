import express from 'express';
import { loginUser } from '../controller/authController.js';
import { 
  getPatients, 
  createPatient, 
  updatePatient,
  deletePatient,
  saveTriageAssessment, 
  createPrescription, 
  getPrescriptions, 
  getInventory, 
  replenishDrug,
  syncBulkData
} from '../controller/healthController.js';

const router = express.Router();

// Auth Route
router.post('/auth/login', loginUser);

// Patient Routes
router.get('/patients', getPatients);
router.post('/patients', createPatient);
router.put('/patients/:id', updatePatient);
router.delete('/patients/:id', deletePatient);

// Triage Routes
router.post('/triage', saveTriageAssessment);

// Prescription Routes
router.get('/prescriptions', getPrescriptions);
router.post('/prescriptions', createPrescription);

// Inventory Routes
router.get('/inventory', getInventory);
router.patch('/inventory/:id/replenish', replenishDrug);

// Offline Sync Route
router.post('/sync/bulk', syncBulkData);

export default router;