import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:5000/api'
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('swasthya_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth
export const loginApi = (credentials) => API.post('/auth/login', credentials);

// Patients
export const fetchPatientsApi = () => API.get('/patients');
export const createPatientApi = (patientData) => API.post('/patients', patientData);
export const updatePatientApi = (id, patientData) => API.put(`/patients/${id}`, patientData);
export const deletePatientApi = (id) => API.delete(`/patients/${id}`);

// Triage
export const submitTriageApi = (triageData) => API.post('/triage', triageData);

// Prescriptions
export const fetchPrescriptionsApi = () => API.get('/prescriptions');
export const createPrescriptionApi = (rxData) => API.post('/prescriptions', rxData);

// Inventory
export const fetchInventoryApi = () => API.get('/inventory');
export const replenishDrugApi = (drugId) => API.patch(`/inventory/${drugId}/replenish`);

// Bulk Offline Sync
export const syncBulkApi = (syncPayload) => API.post('/sync/bulk', syncPayload);

export default API;