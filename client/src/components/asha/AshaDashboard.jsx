import React, { useState, useEffect } from 'react';
import TriageAssessmentModal from './TriageAssessmentModal';
import AbhaCardModal from './AbhaCardModal';
import { useAuth } from '../../context/AuthContext';
import { 
  fetchPatientsApi, 
  createPatientApi, 
  updatePatientApi,
  deletePatientApi,
  submitTriageApi 
} from '../../utils/api';
import { 
  savePatientLocally, 
  getAllLocalPatients, 
  saveTriageLocally 
} from '../../db/offlineDb';
import { useNetworkSync } from '../../utils/useNetworkSync';
import { 
  UserPlus, 
  Activity, 
  Wifi, 
  WifiOff, 
  AlertTriangle, 
  Search, 
  QrCode, 
  ChevronRight,
  HeartPulse,
  RefreshCw,
  CheckCircle2,
  Trash2,
  Edit2,
  AlertOctagon,
  X
} from 'lucide-react';

export default function AshaDashboard() {
  const { user } = useAuth();
  const [patients, setPatients] = useState([]);
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [patientToDelete, setPatientToDelete] = useState(null);
  const [selectedPatientForTriage, setSelectedPatientForTriage] = useState(null);
  const [selectedPatientForCard, setSelectedPatientForCard] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const loadPatientsData = async () => {
    try {
      if (navigator.onLine) {
        const { data } = await fetchPatientsApi();
        if (data && data.length > 0) {
          setPatients(data);
          for (const p of data) {
            await savePatientLocally({ ...p, id: p._id || p.id });
          }
          setLoading(false);
          return;
        }
      }
      const localData = await getAllLocalPatients();
      setPatients(localData || []);
    } catch (err) {
      console.warn('API fetch failed, loading IndexedDB fallback:', err);
      const localData = await getAllLocalPatients();
      setPatients(localData || []);
    } finally {
      setLoading(false);
    }
  };

  const { isOnline, syncing, syncMessage } = useNetworkSync(() => {
    loadPatientsData();
  });

  useEffect(() => {
    loadPatientsData();
  }, []);

  const [newPatient, setNewPatient] = useState({
    fullName: '',
    age: '',
    gender: 'Female',
    village: 'Kunda Village',
    category: 'General'
  });

  const handleCreatePatient = async (e) => {
    e.preventDefault();
    const payload = {
      name: newPatient.fullName,
      age: Number(newPatient.age),
      gender: newPatient.gender,
      village: newPatient.village,
      category: newPatient.category,
      severity: 'LOW_GREEN',
      lastVitals: { bp: '120/80', pulse: 75, spO2: 98 }
    };

    try {
      if (isOnline) {
        const { data } = await createPatientApi(payload);
        await savePatientLocally({ ...data, id: data._id });
        setPatients([data, ...patients]);
      } else {
        const localCreated = {
          id: `local-${Date.now()}`,
          abhaId: `91-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
          ...payload,
          syncStatus: 'PENDING'
        };
        await savePatientLocally(localCreated);
        setPatients([localCreated, ...patients]);
      }
      setShowNewPatientModal(false);
      setNewPatient({ fullName: '', age: '', gender: 'Female', village: 'Kunda Village', category: 'General' });
    } catch (err) {
      console.error('Failed to register patient:', err);
    }
  };

  const handleUpdatePatient = async (e) => {
    e.preventDefault();
    try {
      const patientId = editingPatient._id || editingPatient.id;
      const payload = {
        name: editingPatient.name,
        age: Number(editingPatient.age),
        gender: editingPatient.gender,
        village: editingPatient.village,
        category: editingPatient.category
      };

      if (isOnline) {
        const { data } = await updatePatientApi(patientId, payload);
        setPatients(patients.map(p => ((p._id || p.id) === patientId ? data : p)));
      } else {
        const updated = { ...editingPatient, ...payload };
        await savePatientLocally(updated);
        setPatients(patients.map(p => ((p._id || p.id) === patientId ? updated : p)));
      }
      setEditingPatient(null);
    } catch (err) {
      console.error('Patient record update failed:', err);
    }
  };

  const confirmDeletePatient = async () => {
    if (!patientToDelete) return;
    const pid = patientToDelete._id || patientToDelete.id;

    try {
      if (isOnline) {
        await deletePatientApi(pid);
      }
      setPatients(patients.filter(p => (p._id || p.id) !== pid));
      setPatientToDelete(null);
    } catch (err) {
      console.error('Patient removal failed:', err);
    }
  };

  const handleSaveTriageAssessment = async (assessment) => {
    try {
      if (isOnline) {
        await submitTriageApi(assessment);
      } else {
        await saveTriageLocally(assessment);
      }

      const updated = patients.map(p => {
        const pid = p._id || p.id;
        if (pid === assessment.patientId) {
          const item = {
            ...p,
            severity: assessment.triageResult.severity,
            lastVitals: {
              bp: `${assessment.vitals.systolicBP}/${assessment.vitals.diastolicBP}`,
              pulse: Number(assessment.vitals.pulseRate),
              spO2: Number(assessment.vitals.spO2)
            }
          };
          savePatientLocally(item);
          return item;
        }
        return p;
      });

      setPatients(updated);
    } catch (err) {
      console.error('Triage assessment save error:', err);
    }
  };

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.abhaId?.includes(searchTerm)
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Top Welcome Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">ASHA Field Workdesk</h1>
            
            {isOnline ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Wifi className="w-3 h-3 text-emerald-600" />
                Live Cloud Sync (MongoDB)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300 animate-pulse">
                <WifiOff className="w-3 h-3 text-amber-600" />
                Offline Mode (IndexedDB Active)
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Welcome, <span className="font-semibold text-slate-700">{user?.name}</span> • {user?.phcCenter}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {syncing && (
            <span className="text-xs font-semibold text-teal-600 flex items-center gap-1">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Syncing...
            </span>
          )}
          <button
            onClick={() => setShowNewPatientModal(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold text-sm rounded-xl shadow-md shadow-teal-600/20 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            Onboard New Citizen (ABHA)
          </button>
        </div>
      </div>

      {/* Sync Notification Banner */}
      {syncMessage && (
        <div className="my-4 p-3 bg-teal-50 border border-teal-200 rounded-2xl flex items-center gap-2 text-xs font-semibold text-teal-900 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
          <span>{syncMessage}</span>
        </div>
      )}

      {/* KPI Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Field Patients</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{patients.length}</p>
          </div>
          <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center text-teal-600">
            <Activity className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-rose-600 uppercase tracking-wider">High Risk / Red Alerts</p>
            <p className="text-2xl font-black text-rose-700 mt-1">
              {patients.filter(p => p.severity === 'CRITICAL_RED').length}
            </p>
          </div>
          <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center text-rose-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-teal-600 uppercase tracking-wider">Cloud Storage Engine</p>
            <p className="text-sm font-bold text-slate-800 mt-1">MongoDB Atlas</p>
            <span className="text-[11px] text-emerald-600 font-semibold">● Real-time REST API Bound</span>
          </div>
          <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center text-teal-600">
            <Activity className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Patient List Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900">Assigned Village Patient Queue</h2>
          
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Name or ABHA ID..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-600" />
            Loading registry records from MongoDB Atlas...
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredPatients.map((patient) => {
              const pid = patient._id || patient.id;
              return (
                <div key={pid} className="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center text-sm shrink-0">
                      {patient.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{patient.name}</span>
                        <span className="text-xs text-slate-500 font-medium">({patient.age}y, {patient.gender})</span>
                        {patient.category?.includes('High Risk') && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                            High Risk
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 mt-1">
                        <span 
                          onClick={() => setSelectedPatientForCard(patient)}
                          className="inline-flex items-center gap-1 font-mono text-[11px] bg-slate-100 hover:bg-teal-50 hover:text-teal-700 cursor-pointer px-2 py-0.5 rounded text-slate-700 border border-slate-200 transition-all"
                          title="View and print official ABHA Health QR Card"
                        >
                          <QrCode className="w-3 h-3 text-slate-500" /> {patient.abhaId}
                        </span>
                        <span className="text-xs text-slate-400">• {patient.village}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions & Vitals */}
                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <div className="text-left sm:text-right">
                      <div className="flex items-center gap-1 text-xs font-semibold text-slate-700">
                        <HeartPulse className="w-3.5 h-3.5 text-teal-600" />
                        <span>BP: {patient.lastVitals?.bp || '120/80'}</span>
                        <span className="text-slate-300">|</span>
                        <span>SpO2: {patient.lastVitals?.spO2 || 98}%</span>
                      </div>
                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded mt-1 ${
                        patient.severity === 'CRITICAL_RED'
                          ? 'bg-rose-100 text-rose-800'
                          : patient.severity === 'MODERATE_YELLOW'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {(patient.severity || 'LOW_GREEN').replace('_', ' ')}
                      </span>
                    </div>

                    {/* Edit Record */}
                    <button
                      onClick={() => setEditingPatient(patient)}
                      className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border border-slate-200"
                      title="Edit Demographic Data"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    {/* Delete Record Trigger */}
                    <button
                      onClick={() => setPatientToDelete(patient)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all border border-slate-200"
                      title="Discharge / Remove Record"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    {/* Triage Trigger */}
                    <button
                      onClick={() => setSelectedPatientForTriage(patient)}
                      className="px-3 py-2 text-teal-700 hover:text-white hover:bg-teal-600 bg-teal-50 border border-teal-200 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold shadow-sm"
                    >
                      Triage
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Professional Deletion Dialog Modal */}
      {patientToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200 relative">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
                <AlertOctagon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Discharge Patient Record</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Are you sure you want to remove <span className="font-bold text-slate-800">{patientToDelete.name}</span> from the active clinical registry? This action will archive associated triage history.
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setPatientToDelete(null)}
                className="flex-1 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeletePatient}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-600/20 transition-all"
              >
                Confirm Discharge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Citizen Details */}
      {editingPatient && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Edit Citizen Demographic Record</h3>
              <button onClick={() => setEditingPatient(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-xs text-slate-500 mt-2">ABHA Identification: <span className="font-mono font-bold text-slate-700">{editingPatient.abhaId}</span></p>

            <form onSubmit={handleUpdatePatient} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Full Legal Name</label>
                <input
                  type="text"
                  required
                  value={editingPatient.name}
                  onChange={(e) => setEditingPatient({ ...editingPatient, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-600 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Age</label>
                  <input
                    type="number"
                    required
                    value={editingPatient.age}
                    onChange={(e) => setEditingPatient({ ...editingPatient, age: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-600 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Gender</label>
                  <select
                    value={editingPatient.gender}
                    onChange={(e) => setEditingPatient({ ...editingPatient, gender: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-600 outline-none"
                  >
                    <option>Female</option>
                    <option>Male</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Village / Ward Sector</label>
                <input
                  type="text"
                  required
                  value={editingPatient.village}
                  onChange={(e) => setEditingPatient({ ...editingPatient, village: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Clinical Surveillance Category</label>
                <select
                  value={editingPatient.category}
                  onChange={(e) => setEditingPatient({ ...editingPatient, category: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-600 outline-none"
                >
                  <option>General</option>
                  <option>Maternal (High Risk)</option>
                  <option>Pediatric Care</option>
                  <option>Diabetic</option>
                  <option>Hypertensive</option>
                </select>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingPatient(null)}
                  className="flex-1 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/20"
                >
                  Update Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add New Citizen */}
      {showNewPatientModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Onboard New Citizen</h3>
              <button onClick={() => setShowNewPatientModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mt-2">Generate standardized ABHA identifier and sync to MongoDB cloud.</p>

            <form onSubmit={handleCreatePatient} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Full Legal Name</label>
                <input
                  type="text"
                  required
                  value={newPatient.fullName}
                  onChange={(e) => setNewPatient({ ...newPatient, fullName: e.target.value })}
                  placeholder="e.g. Ananya Sharma"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Age</label>
                  <input
                    type="number"
                    required
                    value={newPatient.age}
                    onChange={(e) => setNewPatient({ ...newPatient, age: e.target.value })}
                    placeholder="25"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Gender</label>
                  <select
                    value={newPatient.gender}
                    onChange={(e) => setNewPatient({ ...newPatient, gender: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600"
                  >
                    <option>Female</option>
                    <option>Male</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Village / Sector</label>
                <input
                  type="text"
                  required
                  value={newPatient.village}
                  onChange={(e) => setNewPatient({ ...newPatient, village: e.target.value })}
                  placeholder="e.g. Kunda Village"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Clinical Surveillance Category</label>
                <select
                  value={newPatient.category}
                  onChange={(e) => setNewPatient({ ...newPatient, category: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  <option>General</option>
                  <option>Maternal (High Risk)</option>
                  <option>Pediatric Care</option>
                  <option>Diabetic</option>
                  <option>Hypertensive</option>
                </select>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowNewPatientModal(false)}
                  className="flex-1 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-md shadow-teal-600/20"
                >
                  Generate ABHA & Register
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Triage Modal */}
      {selectedPatientForTriage && (
        <TriageAssessmentModal
          patient={selectedPatientForTriage}
          onClose={() => setSelectedPatientForTriage(null)}
          onSaveAssessment={handleSaveTriageAssessment}
        />
      )}

      {/* ABHA QR Pass Modal */}
      {selectedPatientForCard && (
        <AbhaCardModal
          patient={selectedPatientForCard}
          onClose={() => setSelectedPatientForCard(null)}
        />
      )}

    </div>
  );
}