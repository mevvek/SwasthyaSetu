import React, { useState, useEffect } from 'react';
import TriageAssessmentModal from './TriageAssessmentModal';
import AbhaCardModal from './AbhaCardModal';
import { useAuth } from '../../context/AuthContext';
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
  CheckCircle2
} from 'lucide-react';

export default function AshaDashboard() {
  const { user } = useAuth();
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [selectedPatientForTriage, setSelectedPatientForTriage] = useState(null);
  const [selectedPatientForCard, setSelectedPatientForCard] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Initial seed state
  const [patients, setPatients] = useState([
    {
      id: 'p-1',
      abhaId: '91-4521-8890-1234',
      name: 'Radha Devi',
      age: 28,
      gender: 'Female',
      village: 'Kunda Village',
      category: 'Maternal (High Risk)',
      severity: 'CRITICAL_RED',
      lastVitals: { bp: '145/95', pulse: 92, spO2: 96 },
      syncStatus: 'SYNCED'
    },
    {
      id: 'p-2',
      abhaId: '91-7890-3341-5521',
      name: 'Ramesh Kumar',
      age: 54,
      gender: 'Male',
      village: 'Rampur',
      category: 'Diabetic',
      severity: 'MODERATE_YELLOW',
      lastVitals: { bp: '130/85', pulse: 76, spO2: 98 },
      syncStatus: 'SYNCED'
    },
    {
      id: 'p-3',
      abhaId: '91-1122-4455-6677',
      name: 'Aarav (Infant)',
      age: 2,
      gender: 'Male',
      village: 'Kunda Village',
      category: 'Pediatric Care',
      severity: 'LOW_GREEN',
      lastVitals: { bp: '95/60', pulse: 105, spO2: 99 },
      syncStatus: 'SYNCED'
    }
  ]);

  // Load offline cached records on start
  const loadLocalData = async () => {
    try {
      const localData = await getAllLocalPatients();
      if (localData && localData.length > 0) {
        setPatients(localData);
      } else {
        for (const p of patients) {
          await savePatientLocally(p);
        }
      }
    } catch (e) {
      console.warn('Local IndexedDB load failed', e);
    }
  };

  // Offline / Online sync hook
  const { isOnline, syncing, syncMessage } = useNetworkSync(() => {
    loadLocalData();
  });

  useEffect(() => {
    loadLocalData();
  }, []);

  // Form State for New Patient
  const [newPatient, setNewPatient] = useState({
    fullName: '',
    age: '',
    gender: 'Female',
    village: 'Kunda Village',
    category: 'General'
  });

  const generateAbhaId = () => {
    const r = () => Math.floor(1000 + Math.random() * 9000);
    return `91-${r()}-${r()}-${r()}`;
  };

  const handleCreatePatient = async (e) => {
    e.preventDefault();
    const created = {
      id: `p-${Date.now()}`,
      abhaId: generateAbhaId(),
      name: newPatient.fullName,
      age: Number(newPatient.age),
      gender: newPatient.gender,
      village: newPatient.village,
      category: newPatient.category,
      severity: 'LOW_GREEN',
      lastVitals: { bp: '120/80', pulse: 75, spO2: 98 },
      syncStatus: isOnline ? 'SYNCED' : 'PENDING'
    };

    await savePatientLocally(created);
    setPatients([created, ...patients]);
    setShowNewPatientModal(false);
    setNewPatient({ fullName: '', age: '', gender: 'Female', village: 'Kunda Village', category: 'General' });
  };

  const handleSaveTriageAssessment = async (assessment) => {
    await saveTriageLocally(assessment);

    const updated = patients.map(p => {
      if (p.id === assessment.patientId) {
        const item = {
          ...p,
          severity: assessment.triageResult.severity,
          lastVitals: {
            bp: `${assessment.vitals.systolicBP}/${assessment.vitals.diastolicBP}`,
            pulse: Number(assessment.vitals.pulseRate),
            spO2: Number(assessment.vitals.spO2)
          },
          syncStatus: isOnline ? 'SYNCED' : 'PENDING'
        };
        savePatientLocally(item);
        return item;
      }
      return p;
    });

    setPatients(updated);
  };

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.abhaId.includes(searchTerm)
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Top Welcome & Network Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">ASHA Field Workdesk</h1>
            
            {isOnline ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Wifi className="w-3 h-3 text-emerald-600" />
                Online (Connected)
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
            <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Offline Storage Cache</p>
            <p className="text-sm font-bold text-slate-800 mt-1">IndexedDB Vault</p>
            <span className="text-[11px] text-emerald-600 font-semibold">● Auto-syncs on reconnect</span>
          </div>
          <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
            <WifiOff className="w-6 h-6" />
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

        <div className="divide-y divide-slate-100">
          {filteredPatients.map((patient) => (
            <div key={patient.id} className="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              
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
                    {patient.syncStatus === 'PENDING' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                        Unsynced
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 mt-1">
                    <span 
                      onClick={() => setSelectedPatientForCard(patient)}
                      className="inline-flex items-center gap-1 font-mono text-[11px] bg-slate-100 hover:bg-teal-50 hover:text-teal-700 cursor-pointer px-2 py-0.5 rounded text-slate-700 border border-slate-200 transition-all"
                      title="Click to view & print ABHA QR Pass"
                    >
                      <QrCode className="w-3 h-3 text-slate-500" /> {patient.abhaId}
                    </span>
                    <span className="text-xs text-slate-400">• {patient.village}</span>
                  </div>
                </div>
              </div>

              {/* Vitals summary & Triage Trigger */}
              <div className="flex items-center justify-between sm:justify-end gap-4">
                <div className="text-left sm:text-right">
                  <div className="flex items-center gap-1 text-xs font-semibold text-slate-700">
                    <HeartPulse className="w-3.5 h-3.5 text-teal-600" />
                    <span>BP: {patient.lastVitals.bp}</span>
                    <span className="text-slate-300">|</span>
                    <span>SpO2: {patient.lastVitals.spO2}%</span>
                  </div>
                  <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded mt-1 ${
                    patient.severity === 'CRITICAL_RED'
                      ? 'bg-rose-100 text-rose-800'
                      : patient.severity === 'MODERATE_YELLOW'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {patient.severity.replace('_', ' ')}
                  </span>
                </div>

                <button
                  onClick={() => setSelectedPatientForTriage(patient)}
                  className="px-3 py-2 text-teal-700 hover:text-white hover:bg-teal-600 bg-teal-50 border border-teal-200 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold shadow-sm"
                  title="Open Clinical Triage Form"
                >
                  Triage
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal: Add New Citizen / ABHA */}
      {showNewPatientModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">Onboard New Citizen</h3>
            <p className="text-xs text-slate-500 mt-0.5">Creates local offline profile & mock 14-digit ABHA ID.</p>

            <form onSubmit={handleCreatePatient} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newPatient.fullName}
                  onChange={(e) => setNewPatient({ ...newPatient, fullName: e.target.value })}
                  placeholder="e.g. Meena Devi"
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
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Village / Ward</label>
                <input
                  type="text"
                  required
                  value={newPatient.village}
                  onChange={(e) => setNewPatient({ ...newPatient, village: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Category</label>
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
                  className="flex-1 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-md shadow-teal-600/20"
                >
                  Generate ABHA & Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Clinical AI Triage Modal */}
      {selectedPatientForTriage && (
        <TriageAssessmentModal
          patient={selectedPatientForTriage}
          onClose={() => setSelectedPatientForTriage(null)}
          onSaveAssessment={handleSaveTriageAssessment}
        />
      )}

      {/* Printable ABHA QR Pass Modal */}
      {selectedPatientForCard && (
        <AbhaCardModal
          patient={selectedPatientForCard}
          onClose={() => setSelectedPatientForCard(null)}
        />
      )}

    </div>
  );
}