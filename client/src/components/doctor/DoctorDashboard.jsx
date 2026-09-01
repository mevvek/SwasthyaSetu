import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import TeleConsultModal from './TeleConsultModal';
import { 
  fetchPatientsApi, 
  createPrescriptionApi, 
  fetchPrescriptionsApi,
  deletePatientApi,
  updatePatientApi 
} from '../../utils/api';
import { 
  Stethoscope, 
  Video, 
  FileText, 
  CheckCircle, 
  Clock, 
  Send,
  CheckCircle2,
  RefreshCw,
  Trash2,
  Check,
  AlertOctagon
} from 'lucide-react';

export default function DoctorDashboard() {
  const { user } = useAuth();
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [activeQueue, setActiveQueue] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [patientToDelete, setPatientToDelete] = useState(null);
  const [completedPrescriptions, setCompletedPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [prescription, setPrescription] = useState({
    diagnosis: 'Pre-eclampsia risk / Pregnancy Induced Hypertension',
    medicines: 'Tab Labetalol 100mg BD, Tab Calcium 500mg OD',
    advice: 'Immediate referral to District Hospital if BP > 150/100. Bed rest advised.'
  });
  const [isSubmitted, setIsSubmitted] = useState(false);

  const loadDoctorData = async () => {
    try {
      const [{ data: patients }, { data: rxList }] = await Promise.all([
        fetchPatientsApi(),
        fetchPrescriptionsApi()
      ]);

      const waiting = patients.filter(
        p => p.severity === 'CRITICAL_RED' || p.severity === 'MODERATE_YELLOW'
      );
      
      setActiveQueue(waiting);
      if (waiting.length > 0) setSelectedCase(waiting[0]);
      else setSelectedCase(null);

      setCompletedPrescriptions(rxList || []);
    } catch (err) {
      console.error('Tele-consultation data load failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDoctorData();
  }, []);

  const handleMarkResolved = async (patientId) => {
    try {
      await updatePatientApi(patientId, { severity: 'LOW_GREEN' });
      const remaining = activeQueue.filter(item => (item._id || item.id) !== patientId);
      setActiveQueue(remaining);
      if (selectedCase && (selectedCase._id || selectedCase.id) === patientId) {
        setSelectedCase(remaining[0] || null);
      }
    } catch (err) {
      console.error('Resolution status update failed:', err);
    }
  };

  const confirmDischargePatient = async () => {
    if (!patientToDelete) return;
    const pid = patientToDelete._id || patientToDelete.id;

    try {
      await deletePatientApi(pid);
      const remaining = activeQueue.filter(item => (item._id || item.id) !== pid);
      setActiveQueue(remaining);
      if (selectedCase && (selectedCase._id || selectedCase.id) === pid) {
        setSelectedCase(remaining[0] || null);
      }
      setPatientToDelete(null);
    } catch (err) {
      console.error('Queue discharge failed:', err);
    }
  };

  const handleCompleteConsult = async (e) => {
    e.preventDefault();
    setIsSubmitted(true);

    try {
      const patientId = selectedCase._id || selectedCase.id;
      const payload = {
        patientId,
        patientName: selectedCase.name,
        doctorName: user?.name || 'Dr. Arvind Sharma',
        diagnosis: prescription.diagnosis,
        medicines: prescription.medicines,
        advice: prescription.advice
      };

      const { data } = await createPrescriptionApi(payload);
      setCompletedPrescriptions([data, ...completedPrescriptions]);
      
      const remaining = activeQueue.filter(item => (item._id || item.id) !== patientId);
      setActiveQueue(remaining);
      setSelectedCase(remaining[0] || null);
      setIsSubmitted(false);
    } catch (err) {
      console.error('Prescription submission failed:', err);
      setIsSubmitted(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Stethoscope className="w-7 h-7 text-emerald-600" />
            Medical Officer Tele-Consult Workdesk
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Logged in as <span className="font-semibold text-slate-800">{user?.name}</span> • {user?.phcCenter}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadDoctorData}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all text-xs font-bold flex items-center gap-1.5"
            title="Refresh Live Consultation Queue"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Tele-OPD Cloud Connected
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        
        {/* Left Side: Priority Queue */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Live Tele-Consult Queue ({activeQueue.length})
              </h3>
              <Clock className="w-4 h-4 text-slate-400" />
            </div>

            {loading ? (
              <div className="text-center py-6 text-xs text-slate-400">
                <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-emerald-600" />
                Loading Priority Queue...
              </div>
            ) : activeQueue.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs font-medium">
                No critical patients waiting in queue.
              </div>
            ) : (
              <div className="space-y-2.5">
                {activeQueue.map((item) => {
                  const pid = item._id || item.id;
                  const isSelected = (selectedCase?._id || selectedCase?.id) === pid;

                  return (
                    <div
                      key={pid}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/60 shadow-sm ring-2 ring-emerald-500/20'
                          : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/70'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div 
                          onClick={() => setSelectedCase(item)}
                          className="cursor-pointer flex-1"
                        >
                          <h4 className="text-sm font-bold text-slate-900">{item.name}</h4>
                          <p className="text-xs text-slate-500">{item.age}y, {item.gender} • {item.village}</p>
                          <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded mt-1 ${
                            item.severity === 'CRITICAL_RED' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {item.severity?.replace('_', ' ')}
                          </span>
                        </div>

                        {/* Quick Actions */}
                        <div className="flex items-center gap-1 ml-2">
                          <button
                            onClick={() => handleMarkResolved(pid)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-all"
                            title="Mark as Resolved"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setPatientToDelete(item)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-100 rounded-lg transition-all"
                            title="Discharge Patient"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Completed Prescriptions History */}
          {completedPrescriptions.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Signed in Cloud ({completedPrescriptions.length})
              </h3>
              <div className="space-y-2">
                {completedPrescriptions.slice(0, 4).map((rx) => (
                  <div key={rx._id || rx.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <p className="font-bold text-slate-900">{rx.patientName}</p>
                    <p className="text-[11px] text-slate-500">{rx.diagnosis}</p>
                    <span className="text-[10px] text-emerald-700 font-semibold">● Synced to MongoDB Atlas</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Consultation Workspace */}
        <div className="lg:col-span-8 space-y-6">
          {selectedCase ? (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{selectedCase.name}</h2>
                  <p className="text-xs text-slate-500">
                    Category: {selectedCase.category} • {selectedCase.village}
                  </p>
                </div>
                <button
                  onClick={() => setShowVideoModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all active:scale-95"
                >
                  <Video className="w-4 h-4" />
                  Connect Live WebRTC Video Room
                </button>
              </div>

              {/* Vitals Summary Strip */}
              <div className="grid grid-cols-3 gap-3 my-4">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Blood Pressure</span>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">{selectedCase.lastVitals?.bp || '120/80'} mmHg</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Pulse Rate</span>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">{selectedCase.lastVitals?.pulse || 75} bpm</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Oxygen Saturation</span>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">{selectedCase.lastVitals?.spO2 || 98}%</p>
                </div>
              </div>

              {/* E-Prescription Form */}
              <form onSubmit={handleCompleteConsult} className="space-y-4">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  Digital E-Prescription & Clinical Orders
                </h3>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Doctor's Clinical Diagnosis</label>
                  <input
                    type="text"
                    required
                    value={prescription.diagnosis}
                    onChange={(e) => setPrescription({ ...prescription, diagnosis: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Prescribed Medicines & Dosage</label>
                  <textarea
                    rows={2}
                    required
                    value={prescription.medicines}
                    onChange={(e) => setPrescription({ ...prescription, medicines: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-mono font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Advice & Follow-up Directives</label>
                  <textarea
                    rows={2}
                    value={prescription.advice}
                    onChange={(e) => setPrescription({ ...prescription, advice: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
                  />
                </div>

                {isSubmitted && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-2xl flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    Prescription saved to MongoDB Atlas!
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitted}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-xs rounded-2xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  Digitally Sign & Sync E-Prescription
                </button>
              </form>

            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400">
              Select a patient from the queue to start tele-consultation.
            </div>
          )}
        </div>

      </div>

      {/* Professional Deletion Modal */}
      {patientToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
                <AlertOctagon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Discharge from Priority Queue</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Are you sure you want to discharge <span className="font-bold text-slate-800">{patientToDelete.name}</span>? This will remove the case from the urgent tele-consultation stream.
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
                onClick={confirmDischargePatient}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-600/20 transition-all"
              >
                Confirm Discharge
              </button>
            </div>
          </div>
        </div>
      )}

      {showVideoModal && selectedCase && (
        <TeleConsultModal
          patient={{ ...selectedCase, patientName: selectedCase.name, ashaName: 'Sunita Devi' }}
          onClose={() => setShowVideoModal(false)}
          onEndCall={() => setShowVideoModal(false)}
        />
      )}

    </div>
  );
}