import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import TeleConsultModal from './TeleConsultModal';
import AmbulanceDispatchModal from '../common/AmbulanceDispatchModal';
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
  Clock, 
  Send, 
  CheckCircle2, 
  RefreshCw, 
  Trash2, 
  Check, 
  Radio, 
  Truck, 
  ShieldAlert, 
  ChevronDown, 
  ChevronUp, 
  Award, 
  Zap, 
  Phone, 
  AlertTriangle 
} from 'lucide-react';

/* --- Clinical Safety Rules --- */
const SAFETY_RULES = [
  {
    id: 'ace-pregnancy',
    match: (text) => /\b(enalapril|lisinopril|ramipril|captopril)\b/i.test(text),
    applies: (patient) => Boolean(patient?.isPregnant || String(patient?.category || '').toLowerCase().includes('pregnant')),
    message: (patient) => `Patient is pregnant (${patient?.gestationalWeeks || '15'}w). ACE inhibitors are contraindicated in pregnancy.`
  },
  {
    id: 'arb-pregnancy',
    match: (text) => /\b(losartan|telmisartan|valsartan)\b/i.test(text),
    applies: (patient) => Boolean(patient?.isPregnant || String(patient?.category || '').toLowerCase().includes('pregnant')),
    message: (patient) => `Patient is pregnant (${patient?.gestationalWeeks || '15'}w). ARBs are contraindicated in pregnancy.`
  },
  {
    id: 'nsaid-pregnancy',
    match: (text) => /\b(ibuprofen|diclofenac|naproxen|nsaid)\b/i.test(text),
    applies: (patient) => Boolean(patient?.isPregnant || String(patient?.category || '').toLowerCase().includes('pregnant')),
    message: () => `Patient is pregnant. NSAIDs carry fetal risk — prefer Paracetamol.`
  },
  {
    id: 'betablocker-asthma',
    match: (text) => /\b(propranolol|atenolol|metoprolol)\b/i.test(text),
    applies: (patient) => /asthma|breath/i.test(patient?.fieldNotes || patient?.lastTriage?.notes || ''),
    message: () => `Field notes mention asthma history. Beta-blockers may trigger bronchospasm.`
  }
];

/* --- Master Clinical Presets Repository --- */
const MASTER_PRESETS = [
  {
    id: 'htn-essential',
    name: 'Essential Hypertension',
    gender: 'ALL',
    requiresPregnant: false,
    trigger: (p, vitals) => vitals.some(v => v.id === 'bp' && v.level !== 'GREEN'),
    diagnosis: 'Essential Hypertension (Stage 1/2)',
    medicines: 'Tab Amlodipine 5mg OD (Morning) x 14 days',
    advice: 'Low salt diet. Monitor BP daily at Health & Wellness Centre. Avoid smoking.'
  },
  {
    id: 'htn-pregnancy',
    name: 'Pregnancy HTN (High Risk)',
    gender: 'FEMALE',
    requiresPregnant: true,
    trigger: (p, vitals) => p.isPregnant && vitals.some(v => v.id === 'bp' && v.level !== 'GREEN'),
    diagnosis: 'Pre-eclampsia risk / Gestational Hypertension',
    medicines: 'Tab Labetalol 100mg BD x 7 days, Tab Calcium 500mg OD',
    advice: 'Immediate referral to District Hospital if BP > 150/100. Strict bed rest.'
  },
  {
    id: 'anc-routine',
    name: 'ANC Prophylaxis',
    gender: 'FEMALE',
    requiresPregnant: true,
    trigger: (p) => p.isPregnant,
    diagnosis: 'Antenatal Routine Prophylaxis & Nutritional Care',
    medicines: 'Tab IFA 1 OD after food, Tab Calcium 500mg OD',
    advice: 'High protein diet. Next ANC checkup at Sub-Centre in 4 weeks.'
  },
  {
    id: 'fever-pyrexia',
    name: 'Acute Pyrexia / Fever',
    gender: 'ALL',
    requiresPregnant: false,
    trigger: (p, vitals) => vitals.some(v => (v.id === 'temp' || v.id.includes('temp')) && v.level !== 'GREEN') || /fever|bukhar/i.test(p.fieldNotes || ''),
    diagnosis: 'Acute Febrile Illness / Pyrexia of Unknown Origin',
    medicines: 'Tab Paracetamol 650mg TDS x 3 days (after food)',
    advice: 'Cold sponge if temp > 101°F. Ample oral hydration. Test for Malaria/Dengue if persistent.'
  },
  {
    id: 'hyperglycemia',
    name: 'Hyperglycemia / Diabetes',
    gender: 'ALL',
    requiresPregnant: false,
    trigger: (p, vitals) => vitals.some(v => v.id.includes('sugar') && v.level !== 'GREEN'),
    diagnosis: 'Type 2 Diabetes Mellitus with Hyperglycemia',
    medicines: 'Tab Metformin 500mg BD (after meals)',
    advice: 'Strictly avoid refined sugar and sweets. Fasting & PP Blood Sugar test advised.'
  },
  {
    id: 'acute-urti',
    name: 'Acute Respiratory / Flu',
    gender: 'ALL',
    requiresPregnant: false,
    trigger: () => true,
    diagnosis: 'Acute Upper Respiratory Tract Infection with Cough',
    medicines: 'Tab Cetirizine 10mg OD HS x 5 days, Syr Ambroxol 10ml TDS',
    advice: 'Drink warm water. Steam inhalation BD. Return if SpO2 drops below 94%.'
  },
  {
    id: 'acute-gi',
    name: 'Acute GI / Dehydration',
    gender: 'ALL',
    requiresPregnant: false,
    trigger: () => true,
    diagnosis: 'Acute Gastroenteritis / Moderate Dehydration Risk',
    medicines: 'ORS packets dissolved in 1L water ad libitum, Tab Zinc 20mg OD x 14 days',
    advice: 'Continue soft bland diet. Watch for dehydration signs.'
  }
];

export default function DoctorDashboard() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showAmbulanceModal, setShowAmbulanceModal] = useState(false);
  const [activeQueue, setActiveQueue] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [completedPrescriptions, setCompletedPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFieldNotes, setShowFieldNotes] = useState(true);

  const [prescription, setPrescription] = useState({ diagnosis: '', medicines: '', advice: '' });
  const [appliedPresetIds, setAppliedPresetIds] = useState([]);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Dynamic Vitals Scanner
  const activeAlertVitals = useMemo(() => {
    if (!selectedCase) return [];

    const t = selectedCase.lastTriage || selectedCase.triage || {};
    const v = selectedCase.lastVitals || selectedCase.vitals || {};
    const p = selectedCase;

    const cards = [];

    // 1. Blood Pressure
    let sys = Number(t.bpSystolic || t.systolic) || 0;
    let dia = Number(t.bpDiastolic || t.diastolic) || 0;
    const rawBp = t.bp || v.bp || p.bp;

    if ((!sys || !dia) && typeof rawBp === 'string' && rawBp.includes('/')) {
      const parts = rawBp.split('/');
      sys = parseInt(parts[0], 10) || 0;
      dia = parseInt(parts[1], 10) || 0;
    }

    if (sys > 0 || dia > 0) {
      const isRed = sys >= 160 || dia >= 100;
      const isYellow = (sys >= 135 && sys < 160) || (dia >= 88 && dia < 100);
      if (isRed || isYellow) {
        cards.push({
          id: 'bp',
          label: 'Blood Pressure',
          value: `${sys}/${dia}`,
          unit: 'mmHg',
          level: isRed ? 'RED' : 'YELLOW',
          tag: isRed ? 'CRITICAL HTN' : 'ELEVATED / PRE-HTN'
        });
      }
    }

    // 2. Pulse Rate
    const pulse = Number(t.pulse || v.pulse || p.pulse) || 0;
    if (pulse > 0) {
      const isRed = pulse >= 130 || pulse < 45;
      const isYellow = (pulse >= 100 && pulse < 130) || (pulse >= 45 && pulse < 55);
      if (isRed || isYellow) {
        cards.push({
          id: 'pulse',
          label: 'Pulse Rate',
          value: pulse,
          unit: 'bpm',
          level: isRed ? 'RED' : 'YELLOW',
          tag: isRed ? 'SEVERE TACHYCARDIA' : 'ELEVATED PULSE'
        });
      }
    }

    // 3. SpO2 Oxygen
    const spo2 = Number(t.spo2 || v.spO2 || v.spo2 || p.spo2) || 0;
    if (spo2 > 0) {
      const isRed = spo2 < 92;
      const isYellow = spo2 >= 92 && spo2 < 94;
      if (isRed || isYellow) {
        cards.push({
          id: 'spo2',
          label: 'Oxygen Saturation',
          value: `${spo2}%`,
          unit: 'SpO2',
          level: isRed ? 'RED' : 'YELLOW',
          tag: isRed ? 'CRITICAL HYPOXIA' : 'LOW OXYGEN'
        });
      }
    }

    // 4. Body Temperature
    const temp = Number(t.temp || v.temp || p.temp) || 0;
    if (temp > 0) {
      const isRed = temp >= 102;
      const isYellow = temp >= 100.4 && temp < 102;
      if (isRed || isYellow) {
        cards.push({
          id: 'temp',
          label: 'Body Temperature',
          value: temp,
          unit: '°F',
          level: isRed ? 'RED' : 'YELLOW',
          tag: isRed ? 'HIGH FEVER' : 'MODERATE FEVER'
        });
      }
    }

    // 5. Blood Sugar
    const directSugar = Number(t.sugar || t.bloodSugar || v.sugar || v.bloodSugar || p.sugar || p.bloodSugar) || 0;
    if (directSugar > 0) {
      const isRed = directSugar >= 200 || directSugar < 60;
      const isYellow = (directSugar >= 140 && directSugar < 200) || (directSugar >= 60 && directSugar < 70);
      if (isRed || isYellow) {
        cards.push({
          id: 'sugar_direct',
          label: 'Blood Glucose (Sugar)',
          value: directSugar,
          unit: 'mg/dL',
          level: isRed ? 'RED' : 'YELLOW',
          tag: isRed ? (directSugar < 60 ? 'HYPOGLYCEMIA' : 'CRITICAL SUGAR') : 'ABNORMAL GLUCOSE'
        });
      }
    }

    // 6. Custom Vitals
    const customList = t.customVitals || p.customVitals || [];
    if (Array.isArray(customList)) {
      customList.forEach((cv, idx) => {
        if (!cv || !cv.title || cv.value === undefined) return;
        const tLower = cv.title.toLowerCase().trim();
        const numVal = parseFloat(cv.value);
        if (isNaN(numVal)) return;

        if (tLower.includes('sugar') && cards.some(c => c.id === 'sugar_direct')) return;

        let level = 'NORMAL';
        let tag = 'NORMAL';

        if (tLower.includes('sugar') || tLower.includes('glucose') || tLower.includes('rbs')) {
          if (numVal >= 200 || numVal < 60) { level = 'RED'; tag = 'CRITICAL SUGAR'; }
          else if (numVal >= 140 || numVal < 70) { level = 'YELLOW'; tag = 'ABNORMAL SUGAR'; }
        } else if (tLower.includes('temp') || tLower.includes('fever') || tLower.includes('bukhar')) {
          if (numVal >= 102) { level = 'RED'; tag = 'HIGH FEVER'; }
          else if (numVal >= 100.4) { level = 'YELLOW'; tag = 'MODERATE FEVER'; }
        } else if (numVal >= 200 || numVal <= 30) {
          level = 'YELLOW'; tag = 'ABNORMAL';
        }

        if (level === 'RED' || level === 'YELLOW') {
          cards.push({
            id: `custom_${cv.id || idx}`,
            label: cv.title.toUpperCase(),
            value: numVal,
            unit: tLower.includes('sugar') ? 'mg/dL' : '',
            level,
            tag
          });
        }
      });
    }

    // Fallback baseline
    if (cards.length === 0) {
      cards.push({
        id: 'bp_norm',
        label: 'Blood Pressure',
        value: (sys > 0 && dia > 0) ? `${sys}/${dia}` : (rawBp || '120/80'),
        unit: 'mmHg',
        level: 'GREEN',
        tag: 'NORMAL'
      });
      cards.push({
        id: 'pulse_norm',
        label: 'Pulse Rate',
        value: pulse > 0 ? pulse : 72,
        unit: 'bpm',
        level: 'GREEN',
        tag: 'NORMAL'
      });
      cards.push({
        id: 'spo2_norm',
        label: 'Oxygen SpO2',
        value: spo2 > 0 ? `${spo2}%` : '98%',
        unit: 'SpO2',
        level: 'GREEN',
        tag: 'NORMAL'
      });
    }

    return cards;
  }, [selectedCase]);

  const isPregnant = Boolean(
    selectedCase?.isPregnant || 
    String(selectedCase?.category || '').toLowerCase().includes('pregnant') ||
    selectedCase?.gestationalWeeks
  );

  const isMale = String(selectedCase?.gender || '').toLowerCase().startsWith('m');

  // Intelligent Contextual Filtering for Presets
  const filteredPresets = useMemo(() => {
    if (!selectedCase) return [];

    return MASTER_PRESETS.filter((preset) => {
      // 1. Gender check: Never show female/maternal presets to male patients
      if (isMale && (preset.gender === 'FEMALE' || preset.requiresPregnant)) {
        return false;
      }

      // 2. Pregnancy check: Only show if patient is actually pregnant
      if (preset.requiresPregnant && !isPregnant) {
        return false;
      }

      // 3. Condition Match
      return preset.trigger(selectedCase, activeAlertVitals);
    });
  }, [selectedCase, isMale, isPregnant, activeAlertVitals]);

  // Append preset logic (allows multi-prescription without wiping)
  const handleApplyPreset = (preset) => {
    setAppliedPresetIds((prev) => 
      prev.includes(preset.id) ? prev : [...prev, preset.id]
    );

    setPrescription((prev) => {
      // Append Diagnosis
      let updatedDiagnosis = prev.diagnosis.trim();
      if (!updatedDiagnosis) {
        updatedDiagnosis = preset.diagnosis;
      } else if (!updatedDiagnosis.toLowerCase().includes(preset.diagnosis.toLowerCase())) {
        updatedDiagnosis = `${updatedDiagnosis} + ${preset.diagnosis}`;
      }

      // Append Medicines on a new line
      let updatedMedicines = prev.medicines.trim();
      if (!updatedMedicines) {
        updatedMedicines = preset.medicines;
      } else if (!updatedMedicines.toLowerCase().includes(preset.medicines.toLowerCase())) {
        updatedMedicines = `${updatedMedicines}\n${preset.medicines}`;
      }

      // Append Advice on a new line
      let updatedAdvice = prev.advice.trim();
      if (!updatedAdvice) {
        updatedAdvice = preset.advice;
      } else if (!updatedAdvice.toLowerCase().includes(preset.advice.toLowerCase())) {
        updatedAdvice = `${updatedAdvice}\n• ${preset.advice}`;
      }

      return {
        diagnosis: updatedDiagnosis,
        medicines: updatedMedicines,
        advice: updatedAdvice
      };
    });
  };

  // Reset form and applied state when switching patient
  const handleSelectPatient = (patient) => {
    const pid = patient._id || patient.id;
    setSelectedCase({ ...patient, hasNewUpdate: false });
    setAppliedPresetIds([]);
    setPrescription({
      diagnosis: patient.fieldNotes || patient.lastTriage?.notes || patient.notes || '',
      medicines: '',
      advice: ''
    });

    setActiveQueue((prev) =>
      prev.map((item) =>
        (item._id || item.id) === pid ? { ...item, hasNewUpdate: false } : item
      )
    );
  };

  // Safety Warnings
  const safetyWarnings = useMemo(() => {
    if (!selectedCase || !prescription.medicines.trim()) return [];
    return SAFETY_RULES
      .filter((rule) => rule.match(prescription.medicines) && rule.applies(selectedCase))
      .map((rule) => ({ id: rule.id, message: rule.message(selectedCase) }));
  }, [selectedCase, prescription.medicines]);

  // Load Priority Queue
  const loadDoctorData = async () => {
    setLoading(true);
    try {
      const [{ data: patients }, { data: rxList }] = await Promise.all([
        fetchPatientsApi(),
        fetchPrescriptionsApi()
      ]);

      const waiting = (patients || []).filter((p) => {
        const sev = String(p.severity || '').toUpperCase();
        return (
          sev.includes('RED') || 
          sev.includes('YELLOW') || 
          p.status === 'QUEUED_FOR_TELEOPD' || 
          p.teleConsultRequested
        );
      });

      setActiveQueue(waiting);
      setSelectedCase((prev) => {
        if (!prev && waiting.length > 0) return waiting[0];
        if (prev) {
          const found = waiting.find((p) => (p._id || p.id) === (prev._id || prev.id));
          return found || waiting[0] || null;
        }
        return null;
      });

      setCompletedPrescriptions(rxList || []);
    } catch (err) {
      console.error('Doctor queue load failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDoctorData();
  }, []);

  // WebSockets & Cross-tab Sync
  useEffect(() => {
    if (!socket) return;

    socket.on('patient_queue_updated', (patient) => {
      const pid = patient._id || patient.id;
      const sev = String(patient.severity || '').toUpperCase();
      const isUrgent = sev.includes('RED') || sev.includes('YELLOW') || patient.status === 'QUEUED_FOR_TELEOPD';

      if (isUrgent) {
        setActiveQueue((prev) => {
          const idx = prev.findIndex((p) => (p._id || p.id) === pid);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = { ...patient, hasNewUpdate: true };
            return next;
          }
          return [{ ...patient, hasNewUpdate: true }, ...prev];
        });

        setSelectedCase((prev) => {
          if ((prev?._id || prev?.id) === pid) {
            return { ...patient, hasNewUpdate: true };
          }
          return prev;
        });
      } else {
        setActiveQueue((prev) => prev.filter((p) => (p._id || p.id) !== pid));
      }
    });

    socket.on('patient_deleted', (deletedId) => {
      setActiveQueue((prev) => prev.filter((p) => (p._id || p.id) !== deletedId));
    });

    return () => {
      socket.off('patient_queue_updated');
      socket.off('patient_deleted');
    };
  }, [socket]);

  useEffect(() => {
    let channel;
    try {
      channel = new BroadcastChannel('swasthya_teleopd_channel');
      channel.onmessage = (e) => {
        if (e.data?.type === 'PATIENT_TRIAGE_UPDATED' && e.data?.payload) {
          const updated = e.data.payload;
          const pid = updated._id || updated.id;

          setActiveQueue((prev) => {
            const index = prev.findIndex(p => (p._id || p.id) === pid);
            if (index !== -1) {
              const next = [...prev];
              next[index] = { ...updated, hasNewUpdate: true };
              return next;
            }
            return [{ ...updated, hasNewUpdate: true }, ...prev];
          });

          setSelectedCase((prev) => {
            if ((prev?._id || prev?.id) === pid) {
              return { ...updated, hasNewUpdate: true };
            }
            return prev;
          });
        } else if (e.data?.type === 'REFRESH_QUEUE') {
          loadDoctorData();
        }
      };
    } catch (err) {
      console.warn(err);
    }
    return () => channel && channel.close();
  }, []);

  const handleCompleteConsult = async (e) => {
    e.preventDefault();
    if (!selectedCase) return;
    setIsSubmitted(true);

    try {
      const pid = selectedCase._id || selectedCase.id;
      const payload = {
        patientId: pid,
        patientName: selectedCase.name,
        doctorName: user?.name || 'Dr. Arvind Sharma (MO)',
        doctorRegNo: 'UP-MCI-84920',
        diagnosis: prescription.diagnosis,
        medicines: prescription.medicines,
        advice: prescription.advice,
        timestamp: new Date().toISOString()
      };

      const { data } = await createPrescriptionApi(payload);
      setCompletedPrescriptions((prev) => [data || payload, ...prev]);

      if (socket) socket.emit('prescription_dispatched', data || payload);

      const remaining = activeQueue.filter((p) => (p._id || p.id) !== pid);
      setActiveQueue(remaining);
      setSelectedCase(remaining[0] || null);
    } catch (err) {
      console.error('Prescription submission failed:', err);
    } finally {
      setIsSubmitted(false);
    }
  };

  const handleResolve = async (pid) => {
    try {
      await updatePatientApi(pid, { severity: 'LOW_GREEN' });
      setActiveQueue((prev) => prev.filter((p) => (p._id || p.id) !== pid));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (pid) => {
    try {
      await deletePatientApi(pid);
      setActiveQueue((prev) => prev.filter((p) => (p._id || p.id) !== pid));
    } catch (err) {
      console.error(err);
    }
  };

  const resolvedPhone = selectedCase?.phone || 
    selectedCase?.mobile || 
    selectedCase?.contactNumber || 
    selectedCase?.contact || 
    'N/A';

  const resolvedNotes = selectedCase?.fieldNotes || 
    selectedCase?.lastTriage?.notes || 
    selectedCase?.notes || 
    'No primary clinical notes recorded.';

  const flaggedCount = activeAlertVitals.filter(c => c.level !== 'GREEN').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Stethoscope className="w-7 h-7 text-emerald-600" />
            Medical Officer Tele-Consult Workdesk
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Logged in as <span className="font-semibold text-slate-800">{user?.name || 'Dr. Arvind Sharma'} (MO)</span> • {user?.phcCenter || 'PHC Tele-OPD Hub'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadDoctorData}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : ''}`} /> Refresh Queue
          </button>
          <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
            <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" /> Live Sync
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        {/* Left Side: Priority Queue */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Live Queue ({activeQueue.length})
              </h3>
              <Clock className="w-4 h-4 text-slate-400" />
            </div>

            {loading ? (
              <div className="text-center py-6 text-xs text-slate-400">Loading Queue...</div>
            ) : activeQueue.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs font-medium">No critical cases waiting.</div>
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
                          ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/70'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div onClick={() => handleSelectPatient(item)} className="cursor-pointer flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900">{item.name}</h4>
                            {item.hasNewUpdate && (
                              <span className="relative flex h-2.5 w-2.5" title="Triage Recently Updated">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">{item.age}y, {item.gender} • {item.village}</p>
                          <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded mt-1 ${
                            item.severity?.includes('RED') ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {item.severity?.replace('_', ' ') || 'QUEUED'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleResolve(pid)} className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded-lg" title="Mark Resolved">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(pid)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-100 rounded-lg" title="Archive">
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

          {completedPrescriptions.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Signed Prescriptions ({completedPrescriptions.length})
              </h3>
              <div className="space-y-2">
                {completedPrescriptions.slice(0, 3).map((rx) => (
                  <div key={rx._id || rx.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <p className="font-bold text-slate-900">{rx.patientName}</p>
                    <p className="text-[11px] text-slate-500">{rx.diagnosis}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Side Consultation Workspace */}
        <div className="lg:col-span-8 space-y-6">
          {selectedCase ? (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
              {/* Patient Info Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-slate-900">{selectedCase.name}</h2>
                    {isPregnant && (
                      <span className="px-2.5 py-0.5 rounded-full bg-pink-100 border border-pink-300 text-pink-700 text-xs font-black">
                        PREGNANT ({selectedCase.gestationalWeeks || '15'}w)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>Age: <strong className="text-slate-700">{selectedCase.age}y</strong></span>
                    <span>•</span>
                    <span>Gender: <strong className="text-slate-700">{selectedCase.gender}</strong></span>
                    <span>•</span>
                    <span>Village: <strong className="text-slate-700">{selectedCase.village || 'N/A'}</strong></span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-400" />
                      Phone: <strong className="text-slate-800">{resolvedPhone}</strong>
                    </span>
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAmbulanceModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all"
                  >
                    <Truck className="w-4 h-4 text-rose-600" /> Dispatch 108 FRU
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowVideoModal(true)}
                    className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow transition-all"
                  >
                    <Video className="w-4 h-4" /> Video Call
                  </button>
                </div>
              </div>

              {/* Dynamic Abnormal Vitals Trigger Strip */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    Triggered Clinical Vitals & Triage Findings
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${flaggedCount > 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
                    {flaggedCount > 0 ? `${flaggedCount} Abnormal Parameter(s) Detected` : 'All Base Vitals Normal'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {activeAlertVitals.map((card) => {
                    const isRed = card.level === 'RED';
                    const isYellow = card.level === 'YELLOW';

                    return (
                      <div
                        key={card.id}
                        className={`p-3.5 rounded-2xl border transition-all ${
                          isRed
                            ? 'bg-rose-50 border-rose-300 text-rose-900 shadow-sm'
                            : isYellow
                            ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-sm'
                            : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">
                            {card.label}
                          </span>
                          <span
                            className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                              isRed
                                ? 'bg-rose-200 text-rose-900 animate-pulse'
                                : isYellow
                                ? 'bg-amber-200 text-amber-900'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {card.tag}
                          </span>
                        </div>
                        <p
                          className={`text-base font-black mt-1 ${
                            isRed ? 'text-rose-700' : isYellow ? 'text-amber-700' : 'text-slate-800'
                          }`}
                        >
                          {card.value} {card.unit && <span className="text-xs font-semibold opacity-75">{card.unit}</span>}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Field Notes Accordion */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowFieldNotes(!showFieldNotes)}
                  className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 text-left text-xs font-bold text-slate-700"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-emerald-600" /> ASHA Observations & Audio Notes
                  </span>
                  {showFieldNotes ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>
                {showFieldNotes && (
                  <div className="p-3 bg-white border-t border-slate-100 text-xs text-slate-600 italic">
                    "{resolvedNotes}"
                  </div>
                )}
              </div>

              {/* Dynamic Contextual 1-Click Quick Presets (Append & Multi-select) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-500" /> Contextual Presets for {selectedCase.name}
                  </span>
                  {appliedPresetIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setAppliedPresetIds([]);
                        setPrescription({ diagnosis: '', medicines: '', advice: '' });
                      }}
                      className="text-[10px] text-slate-400 hover:text-rose-600 font-bold"
                    >
                      Clear Presets
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {filteredPresets.map((p) => {
                    const isApplied = appliedPresetIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleApplyPreset(p)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 ${
                          isApplied
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 border-slate-200'
                        }`}
                      >
                        {isApplied && <Check className="w-3 h-3" />}
                        <span>{p.name}</span>
                        {isApplied && <span className="text-[9px] bg-emerald-700 px-1 rounded text-emerald-100">Added</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Rx Form */}
              <form onSubmit={handleCompleteConsult} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Clinical Diagnosis</label>
                  <input
                    type="text"
                    required
                    value={prescription.diagnosis}
                    onChange={(e) => setPrescription({ ...prescription, diagnosis: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-600 focus:outline-none font-medium"
                    placeholder="Enter clinical diagnosis..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Prescribed Medicines (Multi-dose list)</label>
                  <textarea
                    rows={3}
                    required
                    value={prescription.medicines}
                    onChange={(e) => setPrescription({ ...prescription, medicines: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                    placeholder="Click presets above to add medicines line-by-line..."
                  />

                  {/* Contraindication Flag */}
                  {safetyWarnings.length > 0 && (
                    <div className="mt-2 p-3 bg-rose-50 border-2 border-rose-300 rounded-xl space-y-1">
                      <div className="flex items-center gap-1.5 text-rose-800 text-xs font-bold uppercase">
                        <ShieldAlert className="w-4 h-4 text-rose-600 animate-bounce" /> Clinical Safety Contraindication
                      </div>
                      {safetyWarnings.map((w) => (
                        <p key={w.id} className="text-xs font-semibold text-rose-700 leading-snug">⚠️ {w.message}</p>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Advice & Follow-up</label>
                  <textarea
                    rows={2}
                    value={prescription.advice}
                    onChange={(e) => setPrescription({ ...prescription, advice: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-600 focus:outline-none font-medium"
                    placeholder="Advice or follow-up instructions..."
                  />
                </div>

                {/* ABDM Seal Badge */}
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-emerald-600" />
                    <div>
                      <p className="text-xs font-bold text-slate-800">{user?.name || 'Dr. Arvind Sharma'}, MBBS, MD</p>
                      <p className="text-[10px] text-slate-500">MCI Reg: <span className="font-semibold text-slate-700">UP-MCI-84920</span> • ABDM Verified</p>
                    </div>
                  </div>
                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">DIGITAL SEAL READY</span>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitted}
                  className={`w-full py-2.5 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.99] ${
                    safetyWarnings.length > 0 ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  <Send className="w-4 h-4" />
                  {safetyWarnings.length > 0 ? 'Sign & Sync (Safety Flag Active)' : 'Digitally Sign & Sync E-Prescription'}
                </button>
              </form>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 text-xs">
              Select a patient from the queue to start tele-consultation.
            </div>
          )}
        </div>
      </div>

      {/* Ambulance Dispatch Modal */}
      {showAmbulanceModal && selectedCase && (
        <AmbulanceDispatchModal
          patient={selectedCase}
          onClose={() => setShowAmbulanceModal(false)}
          onConfirmDispatch={(data) => socket && socket.emit('dispatch_emergency_ambulance', data)}
        />
      )}

      {/* Video Call Modal */}
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