import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import TeleConsultModal from './TeleConsultModal';
import { 
  Stethoscope, 
  Video, 
  FileText, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Activity, 
  Pill,
  Send,
  Download,
  CheckCircle2
} from 'lucide-react';

export default function DoctorDashboard() {
  const { user } = useAuth();
  const [showVideoModal, setShowVideoModal] = useState(false);

  // Active queue state
  const [activeQueue, setActiveQueue] = useState([
    {
      id: 'c-1',
      patientName: 'Radha Devi',
      age: 28,
      gender: 'Female',
      village: 'Kunda Village',
      ashaName: 'Sunita Devi',
      severity: 'CRITICAL_RED',
      symptoms: 'Severe headache, elevated BP (145/95), blurred vision in 3rd trimester.',
      vitals: { bp: '145/95', pulse: 92, spO2: '96%' },
      status: 'WAITING'
    },
    {
      id: 'c-2',
      patientName: 'Ramesh Kumar',
      age: 54,
      gender: 'Male',
      village: 'Rampur',
      ashaName: 'Meena Kumari',
      severity: 'MODERATE_YELLOW',
      symptoms: 'Uncontrolled blood sugar, foot numbness for 2 weeks.',
      vitals: { bp: '130/85', pulse: 76, spO2: '98%' },
      status: 'WAITING'
    }
  ]);

  const [selectedCase, setSelectedCase] = useState(activeQueue[0]);
  const [prescription, setPrescription] = useState({
    diagnosis: 'Pre-eclampsia risk / Pregnancy Induced Hypertension',
    medicines: 'Tab Labetalol 100mg BD, Tab Calcium 500mg OD',
    advice: 'Immediate referral to District Hospital if BP > 150/100. Bed rest advised.'
  });
  const [completedPrescriptions, setCompletedPrescriptions] = useState([]);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleCompleteConsult = (e) => {
    e.preventDefault();
    setIsSubmitted(true);

    const record = {
      id: `rx-${Date.now()}`,
      patientName: selectedCase.patientName,
      doctorName: user?.name || 'Dr. Arvind Sharma',
      diagnosis: prescription.diagnosis,
      medicines: prescription.medicines,
      advice: prescription.advice,
      timestamp: new Date().toLocaleString()
    };

    setTimeout(() => {
      setCompletedPrescriptions([record, ...completedPrescriptions]);
      const remaining = activeQueue.filter(item => item.id !== selectedCase.id);
      setActiveQueue(remaining);
      setSelectedCase(remaining[0] || null);
      setIsSubmitted(false);
    }, 1000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Top Header */}
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
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Tele-OPD Ready
          </span>
        </div>
      </div>

      {/* Main Grid: Patient Queue & E-Prescription */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        
        {/* Left Side: Waiting Queue (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Live Tele-Consult Queue ({activeQueue.length})
              </h3>
              <Clock className="w-4 h-4 text-slate-400" />
            </div>

            {activeQueue.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                No patients waiting in queue.
              </div>
            ) : (
              <div className="space-y-2.5">
                {activeQueue.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedCase(item)}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      selectedCase?.id === item.id
                        ? 'border-emerald-600 bg-emerald-50/60 shadow-sm ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/70'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{item.patientName}</h4>
                        <p className="text-xs text-slate-500">{item.age}y, {item.gender} • {item.village}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        item.severity === 'CRITICAL_RED'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {item.severity.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="mt-2 text-[11px] text-slate-600 font-medium">
                      ASHA Worker: <span className="text-slate-800 font-semibold">{item.ashaName}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Completed Prescriptions History */}
          {completedPrescriptions.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Signed Today ({completedPrescriptions.length})
              </h3>
              <div className="space-y-2">
                {completedPrescriptions.map((rx) => (
                  <div key={rx.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <p className="font-bold text-slate-900">{rx.patientName}</p>
                    <p className="text-[11px] text-slate-500">{rx.diagnosis}</p>
                    <span className="text-[10px] text-emerald-700 font-semibold">● E-Prescription Synced</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Active Teleconsultation & E-Prescription Form (8 Cols) */}
        <div className="lg:col-span-8 space-y-6">
          {selectedCase ? (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
              
              {/* Tele-Consult Header Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{selectedCase.patientName}</h2>
                  <p className="text-xs text-slate-500">
                    Facilitated by ASHA {selectedCase.ashaName} • {selectedCase.village}
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
                  <p className="text-sm font-bold text-slate-900 mt-0.5">{selectedCase.vitals.bp} mmHg</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Pulse Rate</span>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">{selectedCase.vitals.pulse} bpm</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Oxygen Saturation</span>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">{selectedCase.vitals.spO2}</p>
                </div>
              </div>

              {/* Symptoms Overview */}
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl mb-6">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 mb-1">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  Reported Field Triage Symptoms
                </div>
                <p className="text-xs text-amber-800">{selectedCase.symptoms}</p>
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
                    Digital E-Prescription signed & synced back to ASHA field unit!
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

      {/* WebRTC Video Consultation Room Modal */}
      {showVideoModal && selectedCase && (
        <TeleConsultModal
          patient={selectedCase}
          onClose={() => setShowVideoModal(false)}
          onEndCall={() => setShowVideoModal(false)}
        />
      )}

    </div>
  );
}