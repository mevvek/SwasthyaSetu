import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useSocket } from '../../context/SocketContext';
import { db } from '../../db/offlineDb';
import { useNetworkSync } from '../../utils/useNetworkSync';
import { useSpeechRecognition } from '../../utils/useSpeechRecognition';
import { 
  deletePatientApi, 
  updatePatientApi, 
  createPatientApi 
} from '../../utils/api';
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  Activity, 
  QrCode, 
  Video, 
  CloudCheck, 
  CloudOff, 
  AlertTriangle,
  Baby,
  Phone,
  MapPin,
  Mic,
  MicOff,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  FileText,
  Pill,
  X,
  Printer,
  Edit2,
  Trash2
} from 'lucide-react';
import TriageAssessmentModal from './TriageAssessmentModal';
import AbhaCardModal from './AbhaCardModal';
import TeleConsultModal from '../doctor/TeleConsultModal';

export default function AshaDashboard() {
  const { t, lang } = useLanguage();
  const { socket } = useSocket();
  const { isSyncing, pendingCount } = useNetworkSync();
  const { isListening, transcript, startListening, stopListening } = useSpeechRecognition();

  const [patients, setPatients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [patientToDelete, setPatientToDelete] = useState(null);

  const [selectedPatientForTriage, setSelectedPatientForTriage] = useState(null);
  const [selectedPatientForAbha, setSelectedPatientForAbha] = useState(null);
  const [selectedPatientForTele, setSelectedPatientForTele] = useState(null);
  
  // Real-time prescription state
  const [selectedRxPatient, setSelectedRxPatient] = useState(null);
  const [liveRxAlert, setLiveRxAlert] = useState(null);

  // Form State with clean empty defaults (Placeholders will display)
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gender: 'Female',
    village: '',
    phone: '',
    abhaId: '',
    isPregnant: false,
    gestationalWeeks: '',
    fieldNotes: ''
  });

  // Speech transcript live update into field notes
  useEffect(() => {
    if (transcript) {
      setFormData((prev) => ({
        ...prev,
        fieldNotes: prev.fieldNotes ? `${prev.fieldNotes} ${transcript}` : transcript
      }));
    }
  }, [transcript]);

  // Load citizens from IndexedDB
  const loadPatients = async () => {
    try {
      const records = await db.patients.toArray();
      if (records && records.length > 0) {
        setPatients(records);
      } else {
        const initialMock = [
          {
            id: 'pat_001',
            _id: 'pat_001',
            name: 'Sunita Devi',
            age: 24,
            gender: 'Female',
            village: 'Rampur Sub-Center',
            phone: '9876541230',
            abhaId: '91-4521-8890-1234',
            isPregnant: true,
            gestationalWeeks: 32,
            severity: 'CRITICAL_RED',
            lastTriage: { severity: 'RED', score: 85, timestamp: new Date().toISOString() },
            synced: true,
            fieldNotes: 'Severe pedal edema and mild headache reported.',
            prescription: null
          },
          {
            id: 'pat_002',
            _id: 'pat_002',
            name: 'Ramesh Kumar',
            age: 58,
            gender: 'Male',
            village: 'Shivpur Hub',
            phone: '9812345678',
            abhaId: '91-1122-3344-5566',
            isPregnant: false,
            gestationalWeeks: null,
            severity: 'MODERATE_YELLOW',
            lastTriage: { severity: 'YELLOW', score: 45, timestamp: new Date().toISOString() },
            synced: false,
            fieldNotes: 'Persistent dry cough for 3 weeks.',
            prescription: null
          },
          {
            id: 'pat_003',
            _id: 'pat_003',
            name: 'Pooja Verma',
            age: 21,
            gender: 'Female',
            village: 'Kalyanpur',
            phone: '9988776655',
            abhaId: '91-9988-7766-5544',
            isPregnant: true,
            gestationalWeeks: 14,
            severity: 'LOW_GREEN',
            lastTriage: { severity: 'GREEN', score: 10, timestamp: new Date().toISOString() },
            synced: true,
            fieldNotes: 'Routine ANC checkup, normal vitals.',
            prescription: null
          }
        ];
        await db.patients.bulkPut(initialMock);
        setPatients(initialMock);
      }
    } catch (err) {
      console.error('Failed to read from local DB:', err);
    }
  };

  useEffect(() => {
    loadPatients();
  }, []);

  // Listen to incoming prescriptions & patient updates
  useEffect(() => {
    const handleIncomingPrescription = (rxData) => {
      console.log('⚡ ASHA Received Rx:', rxData);

      // Play real-time alert chime
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(587.33, ctx.currentTime);
          osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
          gain.gain.setValueAtTime(0.2, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.4);
        }
      } catch (e) {
        console.warn('Audio alert failed', e);
      }

      setLiveRxAlert(rxData);

      setPatients((prev) =>
        prev.map((p) => {
          const pid = p._id || p.id;
          const rxPid = rxData.patientId || rxData._id || rxData.id;
          const match = (pid && rxPid && String(pid) === String(rxPid)) || 
                        (p.name && rxData.patientName && p.name.trim().toLowerCase() === rxData.patientName.trim().toLowerCase());

          if (match) {
            const updated = { ...p, prescription: rxData };
            db.patients.put(updated).catch(() => {});
            return updated;
          }
          return p;
        })
      );

      setTimeout(() => {
        setLiveRxAlert((curr) => (curr?.timestamp === rxData.timestamp ? null : curr));
      }, 7000);
    };

    if (socket) {
      socket.on('prescription_dispatched', handleIncomingPrescription);
    }

    // Cross-Tab fallback sync channel
    const channel = new BroadcastChannel('swasthya_rx_channel');
    channel.onmessage = (event) => {
      if (event.data && event.data.type === 'RX_DISPATCHED') {
        handleIncomingPrescription(event.data.payload);
      }
    };

    if (socket) {
      socket.on('patient_deleted', (deletedId) => {
        setPatients((prev) => prev.filter(p => (p._id || p.id) !== deletedId));
      });
    }

    return () => {
      if (socket) {
        socket.off('prescription_dispatched', handleIncomingPrescription);
        socket.off('patient_deleted');
      }
      channel.close();
    };
  }, [socket]);

  // Open Edit Modal
  const handleOpenEdit = (patient) => {
    setEditingPatient(patient);
    setFormData({
      name: patient.name,
      age: patient.age,
      gender: patient.gender,
      village: patient.village || '',
      phone: patient.phone || '',
      abhaId: patient.abhaId || '',
      isPregnant: !!patient.isPregnant,
      gestationalWeeks: patient.gestationalWeeks || '',
      fieldNotes: patient.fieldNotes || ''
    });
    setIsRegisterOpen(true);
  };

  // Submit Register or Edit Form
  const handleRegisterOrEditSubmit = async (e) => {
    e.preventDefault();
    
    if (editingPatient) {
      // EDIT MODE
      const pid = editingPatient._id || editingPatient.id;
      const updatedCitizen = {
        ...editingPatient,
        ...formData,
        age: Number(formData.age),
        gestationalWeeks: formData.isPregnant ? Number(formData.gestationalWeeks) : null,
        synced: true
      };

      try {
        await db.patients.put(updatedCitizen);
        try {
          await updatePatientApi(pid, updatedCitizen);
        } catch (apiErr) {
          console.warn('Backend update failed, kept offline:', apiErr);
        }

        if (socket) {
          socket.emit('patient_queue_updated', updatedCitizen);
        }

        setPatients((prev) => prev.map(p => (p._id || p.id) === pid ? updatedCitizen : p));
        setIsRegisterOpen(false);
        setEditingPatient(null);
      } catch (err) {
        console.error('Error updating patient:', err);
      }
    } else {
      // CREATE MODE
      const tempId = `pat_${Date.now()}`;
      const newCitizen = {
        id: tempId,
        _id: tempId,
        ...formData,
        age: Number(formData.age),
        gestationalWeeks: formData.isPregnant ? Number(formData.gestationalWeeks) : null,
        severity: 'LOW_GREEN',
        lastTriage: null,
        prescription: null,
        synced: false,
        createdAt: new Date().toISOString()
      };

      try {
        try {
          const res = await createPatientApi(newCitizen);
          if (res?.data?._id) {
            newCitizen._id = res.data._id;
            newCitizen.id = res.data._id;
            newCitizen.synced = true;
          }
        } catch (apiErr) {
          console.warn('API sync pending, saved in IndexedDB:', apiErr);
        }

        await db.patients.add(newCitizen);

        if (socket) {
          socket.emit('patient_queue_updated', newCitizen);
        }

        setPatients((prev) => [newCitizen, ...prev]);
        setIsRegisterOpen(false);
      } catch (err) {
        console.error('Error adding citizen to IndexedDB:', err);
      }
    }

    setFormData({
      name: '',
      age: '',
      gender: 'Female',
      village: '',
      phone: '',
      abhaId: '',
      isPregnant: false,
      gestationalWeeks: '',
      fieldNotes: ''
    });
  };

  // Delete Citizen
  const confirmDeleteCitizen = async () => {
    if (!patientToDelete) return;
    const pid = patientToDelete._id || patientToDelete.id;

    try {
      await db.patients.delete(pid);
      try {
        await deletePatientApi(pid);
      } catch (apiErr) {
        console.warn('API delete failed, deleted from local DB:', apiErr);
      }

      if (socket) {
        socket.emit('patient_deleted', pid);
      }

      setPatients((prev) => prev.filter(p => (p._id || p.id) !== pid));
      setPatientToDelete(null);
    } catch (err) {
      console.error('Error deleting patient:', err);
    }
  };

  const filteredPatients = patients.filter((p) => {
    const matchesSearch = 
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.phone?.includes(searchQuery) ||
      p.abhaId?.includes(searchQuery);

    if (!matchesSearch) return false;

    const sev = p.severity || (p.lastTriage?.severity === 'RED' ? 'CRITICAL_RED' : p.lastTriage?.severity === 'YELLOW' ? 'MODERATE_YELLOW' : 'LOW_GREEN');

    if (severityFilter === 'RED') return sev === 'CRITICAL_RED' || p.lastTriage?.severity === 'RED';
    if (severityFilter === 'YELLOW') return sev === 'MODERATE_YELLOW' || p.lastTriage?.severity === 'YELLOW';
    if (severityFilter === 'GREEN') return sev === 'LOW_GREEN' || p.lastTriage?.severity === 'GREEN';

    return true;
  });

  const getTriagePill = (patient) => {
    const sev = patient?.severity || patient?.lastTriage?.severity;
    if (!patient?.lastTriage && (!sev || sev === 'LOW_GREEN')) {
      return (
        <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-500 text-[11px] font-bold border border-slate-200">
          Pending Triage
        </span>
      );
    }
    if (sev === 'CRITICAL_RED' || sev === 'RED') {
      return (
        <span className="px-2.5 py-1 rounded-xl bg-rose-50 text-rose-700 text-[11px] font-black border border-rose-200 flex items-center gap-1 shadow-sm">
          <AlertTriangle className="w-3 h-3 text-rose-600" />
          {t.criticalFilter}
        </span>
      );
    }
    if (sev === 'MODERATE_YELLOW' || sev === 'YELLOW') {
      return (
        <span className="px-2.5 py-1 rounded-xl bg-amber-50 text-amber-700 text-[11px] font-black border border-amber-200 flex items-center gap-1">
          <Activity className="w-3 h-3 text-amber-600" />
          {t.moderateFilter}
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 text-[11px] font-black border border-emerald-200 flex items-center gap-1">
        <Activity className="w-3 h-3 text-emerald-600" />
        {t.normalFilter}
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 font-sans">
      
      {/* Real-time Notification Banner from Doctor */}
      {liveRxAlert && (
        <div className="p-4 bg-emerald-950 border-2 border-emerald-500 text-white rounded-3xl shadow-xl flex items-center justify-between gap-4 animate-bounce">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shrink-0">
              <Pill className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-black text-emerald-400 uppercase tracking-wider">
                {lang === 'hi' ? 'डॉक्टर द्वारा डिजिटल पर्ची जारी (Digital Rx Received)' : 'Digital Prescription Dispatched by Doctor'}
              </p>
              <p className="text-sm font-bold text-white">
                {lang === 'hi' ? (
                  <>
                    {liveRxAlert.doctorName} ने <span className="underline decoration-emerald-400">{liveRxAlert.patientName}</span> के लिए दवा एवं निर्देश भेजे हैं।
                  </>
                ) : (
                  <>
                    {liveRxAlert.doctorName} has issued Rx & Clinical Orders for <span className="underline decoration-emerald-400">{liveRxAlert.patientName}</span>.
                  </>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setSelectedRxPatient({ name: liveRxAlert.patientName, prescription: liveRxAlert });
              setLiveRxAlert(null);
            }}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs rounded-xl transition-all shrink-0"
          >
            {lang === 'hi' ? 'तुरंत देखें (View Rx)' : 'View Rx'}
          </button>
        </div>
      )}

      {/* Header & Stats Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              {t.ashaDeskTitle}
            </h1>
            <span className="px-2 py-0.5 rounded-md bg-teal-50 border border-teal-200 text-teal-700 text-[10px] font-bold">
              Sub-Center Hub
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {t.ashaDeskSub} • Total Registered: <span className="font-bold text-slate-800">{patients.length}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {pendingCount > 0 ? (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold animate-pulse">
              <CloudOff className="w-4 h-4 text-amber-600" />
              <span>{pendingCount} {t.pendingSync}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{t.syncStatus}</span>
            </div>
          )}

          <button
            onClick={() => {
              setEditingPatient(null);
              setFormData({
                name: '',
                age: '',
                gender: 'Female',
                village: '',
                phone: '',
                abhaId: '',
                isPregnant: false,
                gestationalWeeks: '',
                fieldNotes: ''
              });
              setIsRegisterOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold text-xs shadow-md shadow-teal-600/20 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>{t.registerCitizenBtn}</span>
          </button>
        </div>
      </div>

      {/* Search & Severity Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-2xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium text-slate-900"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" />
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 text-xs rounded-2xl border border-slate-300 bg-white font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-600"
          >
            <option value="ALL">{t.allSeverity}</option>
            <option value="RED">{t.criticalFilter}</option>
            <option value="YELLOW">{t.moderateFilter}</option>
            <option value="GREEN">{t.normalFilter}</option>
          </select>
        </div>
      </div>

      {/* Citizen Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredPatients.map((patient) => {
          const pid = patient._id || patient.id;
          return (
            <div 
              key={pid}
              className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-black text-slate-900 leading-tight">
                      {patient.name}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-1">
                      <span>{patient.gender}, {patient.age} yrs</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {patient.village || 'Field Village'}
                      </span>
                    </div>
                  </div>

                  {/* Actions: Edit & Delete buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(patient)}
                      className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-all"
                      title={lang === 'hi' ? 'नागरिक विवरण संपादित करें' : 'Edit Citizen Details'}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPatientToDelete(patient)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                      title={lang === 'hi' ? 'नागरिक रिकॉर्ड हटाएं' : 'Delete Citizen'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {patient.synced ? (
                      <span className="text-emerald-600 ml-1" title={t.syncStatus}>
                        <CloudCheck className="w-4 h-4" />
                      </span>
                    ) : (
                      <span className="text-amber-500 animate-pulse ml-1" title={t.pendingSync}>
                        <CloudOff className="w-4 h-4" />
                      </span>
                    )}
                  </div>
                </div>

                {patient.isPregnant && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-pink-50 border border-pink-200 text-pink-700 text-[11px] font-bold">
                    <Baby className="w-3.5 h-3.5 text-pink-600" />
                    <span>{t.maternalBadge} ({patient.gestationalWeeks}w)</span>
                  </div>
                )}

                {/* Prescription Badge if Doctor has signed Rx */}
                {patient.prescription && (
                  <div className="flex items-center justify-between p-2 rounded-xl bg-teal-50 border border-teal-200">
                    <span className="text-[10px] font-black text-teal-800 flex items-center gap-1">
                      <Pill className="w-3 h-3 text-teal-600" />
                      {lang === 'hi' ? 'Rx Ready (दवा पर्ची प्राप्त)' : 'Rx Ready (Prescription Received)'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedRxPatient(patient)}
                      className="text-[10px] font-bold text-teal-900 underline hover:text-teal-700"
                    >
                      {lang === 'hi' ? 'पर्ची खोलें' : 'View Rx'}
                    </button>
                  </div>
                )}
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5 text-xs text-slate-600 font-medium">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Phone:</span>
                  <span className="font-semibold text-slate-800">{patient.phone || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">ABHA ID:</span>
                  <span className="font-mono font-semibold text-teal-800 text-[11px]">
                    {patient.abhaId || 'ABHA Unlinked'}
                  </span>
                </div>
                {patient.fieldNotes && (
                  <div className="pt-1 text-[11px] text-slate-500 italic border-t border-slate-200/60 line-clamp-1">
                    "{patient.fieldNotes}"
                  </div>
                )}
              </div>

              <div className="space-y-3 pt-1 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</span>
                  {getTriagePill(patient)}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedPatientForTriage(patient)}
                    className="px-2 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-[11px] font-bold transition-all flex items-center justify-center gap-1"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>{t.btnTriage}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedPatientForAbha(patient)}
                    className="px-2 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-[11px] font-bold transition-all flex items-center justify-center gap-1"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>{t.btnAbha}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedPatientForTele(patient)}
                    className="px-2 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-[11px] font-bold transition-all flex items-center justify-center gap-1"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>{t.btnTele}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filteredPatients.length === 0 && (
          <div className="col-span-full p-12 bg-white rounded-3xl border border-slate-200 text-center space-y-2">
            <Users className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-sm font-bold text-slate-700">{t.noCitizensFound}</p>
          </div>
        )}
      </div>

      {/* Registration / Edit Modal Form */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-950 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                {editingPatient ? <Edit2 className="w-5 h-5 text-teal-400" /> : <UserPlus className="w-5 h-5 text-teal-400" />}
                <h3 className="text-sm font-black tracking-tight">
                  {editingPatient 
                    ? (lang === 'hi' ? 'नागरिक विवरण संपादित करें (Edit Citizen)' : 'Edit Citizen Profile') 
                    : t.registerCitizenBtn}
                </h3>
              </div>
              <button 
                onClick={() => {
                  setIsRegisterOpen(false);
                  setEditingPatient(null);
                }}
                className="text-slate-400 hover:text-white text-xs font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegisterOrEditSubmit} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
                    placeholder="e.g. Suman Devi"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Age (Years)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="120"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
                    placeholder="e.g. 26"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Gender</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium bg-white"
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Village Hub</label>
                  <input
                    type="text"
                    required
                    value={formData.village}
                    onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
                    placeholder="e.g. Rampur Sub-Center"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Contact</label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
                    placeholder="e.g. 9876543210"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ABHA Health ID (Optional)</label>
                  <input
                    type="text"
                    value={formData.abhaId}
                    onChange={(e) => setFormData({ ...formData, abhaId: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
                    placeholder="91-0000-0000-0000"
                  />
                </div>
              </div>

              {formData.gender === 'Female' && (
                <div className="p-3.5 bg-pink-50 rounded-2xl border border-pink-200 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isPregnant}
                      onChange={(e) => setFormData({ ...formData, isPregnant: e.target.checked })}
                      className="w-4 h-4 text-pink-600 rounded focus:ring-pink-500"
                    />
                    <span className="text-xs font-bold text-pink-900">
                      Maternal Patient (Pregnant / High-Risk Antenatal Care)
                    </span>
                  </label>

                  {formData.isPregnant && (
                    <div>
                      <label className="block text-[11px] font-bold text-pink-800 mb-1">
                        Gestational Age (Weeks: 1 to 42)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="42"
                        required
                        value={formData.gestationalWeeks}
                        onChange={(e) => setFormData({ ...formData, gestationalWeeks: e.target.value })}
                        className="w-full px-3 py-1.5 text-xs rounded-xl border border-pink-300 bg-white font-semibold text-pink-950 focus:outline-none focus:ring-2 focus:ring-pink-500"
                        placeholder="e.g. 32"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Hindi Voice Recognition Symptoms with Live Mic Toggle */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Field Clinical Observations / Symptoms
                  </label>
                  <button
                    type="button"
                    onClick={isListening ? stopListening : startListening}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold border transition-all ${
                      isListening 
                        ? 'bg-rose-500 text-white border-rose-600 animate-pulse' 
                        : 'bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100'
                    }`}
                  >
                    {isListening ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3 text-teal-600" />}
                    <span>{isListening ? 'Listening...' : 'Voice Input (Mic)'}</span>
                  </button>
                </div>
                <textarea
                  rows="2"
                  value={formData.fieldNotes}
                  onChange={(e) => setFormData({ ...formData, fieldNotes: e.target.value })}
                  placeholder="Record symptoms or speak in Hindi/English..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsRegisterOpen(false);
                    setEditingPatient(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-sm transition-all"
                >
                  {editingPatient ? 'Save Changes' : 'Register Citizen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {patientToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-black text-slate-900">
              {lang === 'hi' ? 'नागरिक रिकॉर्ड हटाएं (Delete Citizen)' : 'Delete Citizen Record'}
            </h3>
            <p className="text-xs text-slate-500 mt-2">
              {lang === 'hi' ? (
                <>
                  क्या आप सच में <strong className="text-slate-800">{patientToDelete.name}</strong> का रिकॉर्ड हटाना चाहते हैं? यह ऑफलाइन और डॉक्टर कतार दोनों से हट जाएगा।
                </>
              ) : (
                <>
                  Are you sure you want to delete <strong className="text-slate-800">{patientToDelete.name}</strong>? This case will be removed from both offline registry and doctor priority queue.
                </>
              )}
            </p>
            <div className="flex gap-2 mt-5 justify-end">
              <button
                type="button"
                onClick={() => setPatientToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteCitizen}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all"
              >
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ASHA View Prescription Modal (Bilingual Bound) */}
      {selectedRxPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-950 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-400" />
                <h3 className="text-sm font-black tracking-tight">
                  {lang === 'hi' ? 'डॉक्टर द्वारा ई-पर्चा (Digital Prescription)' : 'Digital Clinical Prescription (Rx)'}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedRxPatient(null)}
                className="text-slate-400 hover:text-white text-xs font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex justify-between items-center text-xs">
                <div>
                  <p className="font-bold text-slate-900">{selectedRxPatient.name || selectedRxPatient.patientName}</p>
                  <p className="text-slate-500 text-[11px]">Authorized by: {selectedRxPatient.prescription?.doctorName || 'Medical Officer'}</p>
                </div>
                <span className="px-2 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-lg text-[10px]">
                  ABDM Signed
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  {lang === 'hi' ? 'क्लिनिकल डायग्नोसिस (DIAGNOSIS)' : 'Clinical Diagnosis'}
                </label>
                <p className="text-sm font-bold text-slate-800 bg-teal-50/50 p-2.5 rounded-xl border border-teal-100">
                  {selectedRxPatient.prescription?.diagnosis || 'Diagnosis recorded.'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  {lang === 'hi' ? 'दवाएं एवं खुराक (PRESCRIBED MEDICINES)' : 'Prescribed Medicines & Dosage'}
                </label>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono text-xs text-slate-900 font-bold leading-relaxed whitespace-pre-line">
                  {selectedRxPatient.prescription?.medicines || 'Medicines detailed on cloud.'}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  {lang === 'hi' ? 'आशा कार्यकर्ता एवं मरीज़ के लिए निर्देश (DOCTOR\'S DIRECTIVES)' : 'Doctor\'s Clinical Directives & Advice'}
                </label>
                <p className="text-xs text-slate-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200 leading-relaxed font-medium">
                  {selectedRxPatient.prescription?.advice || 'Regular follow-up advised.'}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{lang === 'hi' ? 'पर्ची प्रिंट करें' : 'Print Rx'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRxPatient(null)}
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all"
                >
                  {lang === 'hi' ? 'मरीज़ को समझा दिया (Done)' : 'Acknowledge & Close'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedPatientForTriage && (
        <TriageAssessmentModal
          patient={selectedPatientForTriage}
          onClose={() => {
            setSelectedPatientForTriage(null);
            loadPatients();
          }}
        />
      )}

      {selectedPatientForAbha && (
        <AbhaCardModal
          patient={selectedPatientForAbha}
          onClose={() => setSelectedPatientForAbha(null)}
        />
      )}

      {selectedPatientForTele && (
        <TeleConsultModal
          patient={selectedPatientForTele}
          onClose={() => setSelectedPatientForTele(null)}
        />
      )}

    </div>
  );
}