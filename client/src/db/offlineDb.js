import Dexie from 'dexie';

export const db = new Dexie('SwasthyaSetuOfflineDB');

// Define IndexedDB Stores
db.version(1).stores({
  patients: 'id, abhaId, name, village, category, severity, syncStatus',
  triageRecords: '++localId, patientId, severity, timestamp, syncStatus'
});

// Helper: Save patient locally
export const savePatientLocally = async (patient) => {
  return await db.patients.put({
    ...patient,
    syncStatus: navigator.onLine ? 'SYNCED' : 'PENDING'
  });
};

// Helper: Get all local patients
export const getAllLocalPatients = async () => {
  return await db.patients.toArray();
};

// Helper: Save Triage Assessment
export const saveTriageLocally = async (assessment) => {
  return await db.triageRecords.add({
    ...assessment,
    syncStatus: navigator.onLine ? 'SYNCED' : 'PENDING'
  });
};

// Helper: Get unsynced pending records
export const getPendingSyncRecords = async () => {
  const unsyncedPatients = await db.patients.where('syncStatus').equals('PENDING').toArray();
  const unsyncedTriage = await db.triageRecords.where('syncStatus').equals('PENDING').toArray();
  return { unsyncedPatients, unsyncedTriage };
};

// Helper: Mark records as synced
export const markRecordsAsSynced = async (patientIds, triageIds) => {
  if (patientIds.length > 0) {
    await db.patients.where('id').anyOf(patientIds).modify({ syncStatus: 'SYNCED' });
  }
  if (triageIds.length > 0) {
    await db.triageRecords.where('localId').anyOf(triageIds).modify({ syncStatus: 'SYNCED' });
  }
};