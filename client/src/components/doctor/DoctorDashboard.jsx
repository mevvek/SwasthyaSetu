import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  AlertTriangle,
  Play,
  Pause,
  Volume2,
  Mic,
  History,
  Calendar,
  X,
  Activity,
  Pill,
  Edit3
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

// Helper to safely format dates without ever showing 'Invalid Date'
const formatSafeDate = (rawDate) => {
  if (!rawDate) return 'Just now';
  const d = new Date(rawDate);
  if (isNaN(d.getTime())) return 'Recently';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + d.toLocaleDateString();
};

export default function DoctorDashboard() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showAmbulanceModal, setShowAmbulanceModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [activeQueue, setActiveQueue] = useState([]);
  const [allPatientsList, setAllPatientsList] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [completedPrescriptions, setCompletedPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFieldNotes, setShowFieldNotes] = useState(true);

  // Tracks if doctor is editing a previous prescription
  const [editingRxId, setEditingRxId] = useState(null);

  // Independent toggle state map for accordion in history modal
  const [expandedRxMap, setExpandedRxMap] = useState({});

  const [prescription, setPrescription] = useState({ diagnosis: '', medicines: '', advice: '' });
  const [appliedPresetIds, setAppliedPresetIds] = useState([]);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Audio Playback States & Refs
  const [playingRegAudio, setPlayingRegAudio] = useState(false);
  const [playingTriageAudio, setPlayingTriageAudio] = useState(false);
  const regAudioPlayerRef = useRef(null);
  const triageAudioPlayerRef = useRef(null);

  // Clean formatted Doctor name
  const cleanDoctorName = useMemo(() => {
    const raw = user?.name || 'Dr. Arvind Sharma (MO)';
    return raw.replace(/(\s*\(MO\))+/gi, '') + ' (MO)';
  }, [user?.name]);

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

  // =========================================================================
  // FIX 1: SIDEBAR SHOWS UNIQUE PATIENTS ONLY (1 Patient = 1 Card)
  // =========================================================================
  const uniqueSignedPatients = useMemo(() => {
    const patientMap = new Map();

    completedPrescriptions.forEach((rx) => {
      const key = String(rx.patientId || rx.patientName || '').trim().toLowerCase();
      if (!key) return;

      if (!patientMap.has(key)) {
        patientMap.set(key, {
          patientKey: key,
          patientId: rx.patientId,
          patientName: rx.patientName,
          latestRx: rx,
          consultCount: 1
        });
      } else {
        const existing = patientMap.get(key);
        existing.consultCount += 1;
        // Keep the latest prescription as primary summary
        if (new Date(rx.timestamp || 0) > new Date(existing.latestRx.timestamp || 0)) {
          existing.latestRx = rx;
        }
      }
    });

    return Array.from(patientMap.values()).sort(
      (a, b) => new Date(b.latestRx.timestamp || 0) - new Date(a.latestRx.timestamp || 0)
    );
  }, [completedPrescriptions]);

  // =========================================================================
  // FIX 2: GET ALL PAST CONSULTATIONS FOR THE SELECTED CITIZEN
  // =========================================================================
  const patientPastConsultations = useMemo(() => {
    if (!selectedCase) return [];
    const pid = String(selectedCase._id || selectedCase.id || '').trim();
    const pName = String(selectedCase.name || '').trim().toLowerCase();

    const matches = completedPrescriptions.filter((rx) => {
      const rxPid = String(rx.patientId || '').trim();
      const rxPName = String(rx.patientName || '').trim().toLowerCase();
      return (pid && rxPid === pid) || (pName && rxPName === pName);
    });

    // Deduplicate identical prescriptions
    const uniqueMap = new Map();
    matches.forEach((item) => {
      const uniqueKey = item._id || `${item.patientId || item.patientName}_${item.timestamp}_${item.diagnosis}`;
      if (!uniqueMap.has(uniqueKey)) {
        uniqueMap.set(uniqueKey, item);
      }
    });

    return Array.from(uniqueMap.values()).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [selectedCase, completedPrescriptions]);

  const isPregnant = Boolean(
    selectedCase?.isPregnant || 
    String(selectedCase?.category || '').toLowerCase().includes('pregnant') ||
    selectedCase?.gestationalWeeks
  );

  const isMale = String(selectedCase?.gender || '').toLowerCase().startsWith('m');

  // Filter Presets
  const filteredPresets = useMemo(() => {
    if (!selectedCase) return [];

    return MASTER_PRESETS.filter((preset) => {
      if (isMale && (preset.gender === 'FEMALE' || preset.requiresPregnant)) {
        return false;
      }
      if (preset.requiresPregnant && !isPregnant) {
        return false;
      }
      return preset.trigger(selectedCase, activeAlertVitals);
    });
  }, [selectedCase, isMale, isPregnant, activeAlertVitals]);

  // Multi-Preset Append Handler
  const handleApplyPreset = (preset) => {
    setAppliedPresetIds((prev) => 
      prev.includes(preset.id) ? prev : [...prev, preset.id]
    );

    setPrescription((prev) => {
      let updatedDiagnosis = prev.diagnosis.trim();
      if (!updatedDiagnosis) {
        updatedDiagnosis = preset.diagnosis;
      } else if (!updatedDiagnosis.toLowerCase().includes(preset.diagnosis.toLowerCase())) {
        updatedDiagnosis = `${updatedDiagnosis} + ${preset.diagnosis}`;
      }

      let updatedMedicines = prev.medicines.trim();
      if (!updatedMedicines) {
        updatedMedicines = preset.medicines;
      } else if (!updatedMedicines.toLowerCase().includes(preset.medicines.toLowerCase())) {
        updatedMedicines = `${updatedMedicines}\n${preset.medicines}`;
      }

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

  // Select patient from live queue
  const handleSelectPatient = (patient) => {
    const pid = patient._id || patient.id;
    if (regAudioPlayerRef.current) regAudioPlayerRef.current.pause();
    if (triageAudioPlayerRef.current) triageAudioPlayerRef.current.pause();
    setPlayingRegAudio(false);
    setPlayingTriageAudio(false);

    setEditingRxId(null);
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

  // OPEN A SIGNED CITIZEN FROM SIDEBAR (INTO EDIT/VIEW MODE)
  const handleOpenSignedPatient = (signedEntry) => {
    if (regAudioPlayerRef.current) regAudioPlayerRef.current.pause();
    if (triageAudioPlayerRef.current) triageAudioPlayerRef.current.pause();
    setPlayingRegAudio(false);
    setPlayingTriageAudio(false);

    const rx = signedEntry.latestRx;
    const rxPid = String(rx.patientId || '');
    const rxPName = String(rx.patientName || '').toLowerCase();

    // Match patient from full database or use latest Rx snapshot
    const foundPatient = allPatientsList.find(p => 
      (rxPid && String(p._id || p.id) === rxPid) || 
      (String(p.name || '').toLowerCase() === rxPName)
    ) || {
      _id: rxPid || `pat_${Date.now()}`,
      id: rxPid || `pat_${Date.now()}`,
      name: rx.patientName,
      age: 24,
      gender: 'Female',
      village: 'Field Center',
      lastTriage: {
        bpSystolic: rx.vitalsAtConsult?.bp?.split('/')[0] || 120,
        bpDiastolic: rx.vitalsAtConsult?.bp?.split('/')[1] || 80,
        pulse: rx.vitalsAtConsult?.pulse || 72,
        spo2: rx.vitalsAtConsult?.spo2 || 98,
        temp: rx.vitalsAtConsult?.temp || 98.6
      },
      lastVitals: rx.vitalsAtConsult || {},
      fieldNotes: rx.fieldNotes || ''
    };

    setSelectedCase(foundPatient);
    setEditingRxId(rx._id || rx.id || rx.timestamp);
    setPrescription({
      diagnosis: rx.diagnosis || '',
      medicines: rx.medicines || '',
      advice: rx.advice || ''
    });
    setAppliedPresetIds([]);
  };

  // DELETE ALL PRESCRIPTIONS FOR A CITIZEN FROM SIGNED LIST
  const handleDeleteSignedCitizen = (e, signedEntry) => {
    e.stopPropagation();
    const key = signedEntry.patientKey;

    setCompletedPrescriptions((prev) => 
      prev.filter(item => String(item.patientId || item.patientName || '').trim().toLowerCase() !== key)
    );

    if (selectedCase && String(selectedCase._id || selectedCase.name || '').trim().toLowerCase() === key) {
      setEditingRxId(null);
      setPrescription({ diagnosis: '', medicines: '', advice: '' });
      setSelectedCase(null);
    }
  };

  const toggleExpandRx = (key) => {
    setExpandedRxMap((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Safety Warnings
  const safetyWarnings = useMemo(() => {
    if (!selectedCase || !prescription.medicines.trim()) return [];
    return SAFETY_RULES
      .filter((rule) => rule.match(prescription.medicines) && rule.applies(selectedCase))
      .map((rule) => ({ id: rule.id, message: rule.message(selectedCase) }));
  }, [selectedCase, prescription.medicines]);

  // Load Priority Queue & All Patients
  const loadDoctorData = async () => {
    setLoading(true);
    try {
      const [{ data: patients }, { data: rxList }] = await Promise.all([
        fetchPatientsApi(),
        fetchPrescriptionsApi()
      ]);

      setAllPatientsList(patients || []);

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

      // Deduplicate initial Rx list
      const initialRx = rxList || [];
      const uniq = new Map();
      initialRx.forEach(item => {
        const key = item._id || `${item.patientId || item.patientName}_${item.timestamp}_${item.diagnosis}`;
        if (!uniq.has(key)) uniq.set(key, item);
      });
      setCompletedPrescriptions(Array.from(uniq.values()));
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
    let rxChannel;
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

      rxChannel = new BroadcastChannel('swasthya_rx_channel');
      rxChannel.onmessage = (e) => {
        if (e.data?.type === 'RX_DISPATCHED' && e.data?.payload) {
          const incoming = e.data.payload;
          setCompletedPrescriptions((prev) => {
            const index = prev.findIndex(p => 
              (incoming._id && p._id === incoming._id) || 
              (p.timestamp === incoming.timestamp && p.patientId === incoming.patientId)
            );
            if (index !== -1) {
              const updatedList = [...prev];
              updatedList[index] = incoming;
              return updatedList;
            }
            return [incoming, ...prev];
          });
        }
      };
    } catch (err) {
      console.warn(err);
    }
    return () => {
      if (channel) channel.close();
      if (rxChannel) rxChannel.close();
    };
  }, []);

  // SUBMIT OR UPDATE IN-PLACE PRESCRIPTION
  const handleCompleteConsult = async (e) => {
    e.preventDefault();
    if (!selectedCase) return;
    setIsSubmitted(true);

    try {
      const pid = selectedCase._id || selectedCase.id;
      const t = selectedCase.lastTriage || {};

      const payload = {
        patientId: pid,
        patientName: selectedCase.name,
        doctorName: cleanDoctorName,
        doctorRegNo: 'UP-MCI-84920',
        diagnosis: prescription.diagnosis,
        medicines: prescription.medicines,
        advice: prescription.advice,
        vitalsAtConsult: {
          bp: t.bpSystolic ? `${t.bpSystolic}/${t.bpDiastolic || 80}` : (selectedCase.lastVitals?.bp || '120/80'),
          pulse: t.pulse || selectedCase.lastVitals?.pulse || 72,
          spo2: t.spo2 || selectedCase.lastVitals?.spO2 || 98,
          temp: t.temp || selectedCase.lastVitals?.temp || 98.6,
          severity: t.severity || selectedCase.severity || 'LOW_GREEN'
        },
        fieldNotes: selectedCase.fieldNotes || t.notes || '',
        timestamp: new Date().toISOString()
      };

      if (editingRxId && typeof editingRxId === 'string' && editingRxId.length < 30) {
        payload._id = editingRxId;
      }

      let savedRx = payload;
      try {
        const { data } = await createPrescriptionApi(payload);
        if (data) savedRx = data;
      } catch (apiErr) {
        console.warn('API fallback to local state:', apiErr);
      }

      // Update state in-place if editing existing, or add if new
      setCompletedPrescriptions((prev) => {
        if (editingRxId) {
          const idx = prev.findIndex(p => (p._id === editingRxId) || (p.timestamp === editingRxId));
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = savedRx;
            return next;
          }
        }
        return [savedRx, ...prev.filter(p => p._id !== savedRx._id)];
      });

      // Broadcast update to ASHA
      try {
        const rxChan = new BroadcastChannel('swasthya_rx_channel');
        rxChan.postMessage({ type: 'RX_DISPATCHED', payload: savedRx });
        rxChan.close();
      } catch (bcErr) {
        console.warn(bcErr);
      }

      if (socket) socket.emit('prescription_dispatched', savedRx);

      try {
        await updatePatientApi(pid, { severity: 'LOW_GREEN', status: 'CONSULT_COMPLETED' });
      } catch (upErr) {
        console.warn(upErr);
      }

      setEditingRxId(null);
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

  // Audio Toggles
  const togglePlayRegAudio = () => {
    if (!regAudioPlayerRef.current) return;
    if (playingRegAudio) {
      regAudioPlayerRef.current.pause();
      setPlayingRegAudio(false);
    } else {
      if (triageAudioPlayerRef.current) {
        triageAudioPlayerRef.current.pause();
        setPlayingTriageAudio(false);
      }
      regAudioPlayerRef.current.play();
      setPlayingRegAudio(true);
    }
  };

  const togglePlayTriageAudio = () => {
    if (!triageAudioPlayerRef.current) return;
    if (playingTriageAudio) {
      triageAudioPlayerRef.current.pause();
      setPlayingTriageAudio(false);
    } else {
      if (regAudioPlayerRef.current) {
        regAudioPlayerRef.current.pause();
        setPlayingRegAudio(false);
      }
      triageAudioPlayerRef.current.play();
      setPlayingTriageAudio(true);
    }
  };

  const resolvedPhone = selectedCase?.phone || 
    selectedCase?.mobile || 
    selectedCase?.contactNumber || 
    selectedCase?.contact || 
    'Not Provided';

  const resolvedNotes = selectedCase?.fieldNotes || 
    selectedCase?.lastTriage?.notes || 
    selectedCase?.notes || 
    'No primary clinical notes recorded.';

  const resolvedRegistrationAudio = selectedCase?.registrationAudioNote || null;
  const resolvedTriageAudio = selectedCase?.triageAudioNote || selectedCase?.lastTriage?.triageAudioNote || null;

  const flaggedCount = activeAlertVitals.filter(c => c.level !== 'GREEN').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Stethoscope className="w-7 h-7 text-emerald-600" />
            Medical Officer Tele-Consult Workdesk
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Logged in as <span className="font-semibold text-slate-800">{cleanDoctorName}</span> • {user?.phcCenter || 'PHC Tele-OPD Hub'}
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
        {/* Left Side: Priority Queue & Signed Citizens */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* 1. Live Queue */}
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
                  const isSelected = (selectedCase?._id || selectedCase?.id) === pid && !editingRxId;
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

          {/* 2. DEDUPLICATED SIGNED CITIZENS LIST (1 Patient = 1 Card) */}
          {uniqueSignedPatients.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Signed Patients ({uniqueSignedPatients.length})
                </h3>
                <span className="text-[9px] text-slate-400 font-bold">Tap to view</span>
              </div>

              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {uniqueSignedPatients.map((entry) => {
                  const isSelected = selectedCase && 
                    String(selectedCase._id || selectedCase.name || '').trim().toLowerCase() === entry.patientKey;

                  return (
                    <div
                      key={entry.patientKey}
                      onClick={() => handleOpenSignedPatient(entry)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex justify-between items-start gap-2 ${
                        isSelected
                          ? 'border-teal-600 bg-teal-50/80 ring-2 ring-teal-500/30'
                          : 'border-slate-200 bg-slate-50 hover:bg-slate-100/80 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-bold text-slate-900 text-xs">{entry.patientName}</p>
                          <span className="text-[9px] font-extrabold bg-teal-100 text-teal-800 px-1.5 py-0.2 rounded-md">
                            {entry.consultCount} {entry.consultCount === 1 ? 'Consult' : 'Consults'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5 font-medium">
                          {entry.latestRx.diagnosis || 'Clinical Diagnosis Recorded'}
                        </p>
                        <p className="text-[9px] text-slate-400 mt-1 font-mono">
                          {formatSafeDate(entry.latestRx.timestamp)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => handleDeleteSignedCitizen(e, entry)}
                          className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                          title="Revoke / Delete Record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
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
                    {editingRxId && (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-[10px] font-black flex items-center gap-1">
                        <Edit3 className="w-3 h-3" /> EDITING SIGNED RECORD
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
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

                    {/* Registration Voice Note */}
                    {resolvedRegistrationAudio && (
                      <>
                        <span>•</span>
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-teal-50 border border-teal-200 rounded-lg text-teal-800">
                          <Volume2 className="w-3 h-3 text-teal-600" />
                          <span className="text-[10px] font-bold">Reg. Voice:</span>
                          <button
                            type="button"
                            onClick={togglePlayRegAudio}
                            className="w-5 h-5 rounded-full bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center transition-all"
                            title={playingRegAudio ? 'Pause' : 'Play Registration Voice'}
                          >
                            {playingRegAudio ? <Pause className="w-2.5 h-2.5 fill-current" /> : <Play className="w-2.5 h-2.5 fill-current ml-0.5" />}
                          </button>
                          <audio
                            ref={regAudioPlayerRef}
                            src={resolvedRegistrationAudio}
                            onEnded={() => setPlayingRegAudio(false)}
                            className="hidden"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setShowHistoryModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition-all shadow-2xs"
                    title="View Complete Clinical History Timeline"
                  >
                    <History className="w-4 h-4 text-teal-600" />
                    <span>Clinical History ({patientPastConsultations.length})</span>
                  </button>

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

              {/* Field Notes & Triage Voice Note Accordion */}
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
                  <div className="p-3.5 bg-white border-t border-slate-100 space-y-2.5">
                    <div className="text-xs text-slate-700 italic bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                      "{resolvedNotes}"
                    </div>

                    {resolvedTriageAudio ? (
                      <div className="p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={togglePlayTriageAudio}
                            className="w-7 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-xs transition-all"
                            title={playingTriageAudio ? 'Pause' : 'Play Triage Audio'}
                          >
                            {playingTriageAudio ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current ml-0.5" />}
                          </button>
                          <div>
                            <p className="text-xs font-bold text-emerald-950 flex items-center gap-1">
                              <Mic className="w-3 h-3 text-emerald-600" /> Field Triage Audio Note
                            </p>
                            <p className="text-[10px] text-emerald-700">Recorded live by ASHA during assessment</p>
                          </div>
                        </div>
                        <span className="text-[9px] font-bold bg-emerald-200/70 text-emerald-900 px-2 py-0.5 rounded-full uppercase">
                          {playingTriageAudio ? 'Playing...' : 'Audio Ready'}
                        </span>
                        <audio
                          ref={triageAudioPlayerRef}
                          src={resolvedTriageAudio}
                          onEnded={() => setPlayingTriageAudio(false)}
                          className="hidden"
                        />
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400 italic px-1">
                        No triage voice note recorded for this assessment.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Contextual 1-Click Quick Presets */}
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
                      <p className="text-xs font-bold text-slate-800">{cleanDoctorName}, MBBS, MD</p>
                      <p className="text-[10px] text-slate-500">MCI Reg: <span className="font-semibold text-slate-700">UP-MCI-84920</span> • ABDM Verified</p>
                    </div>
                  </div>
                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">DIGITAL SEAL READY</span>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitted}
                  className={`w-full py-2.5 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.99] ${
                    editingRxId 
                      ? 'bg-amber-600 hover:bg-amber-700' 
                      : safetyWarnings.length > 0 
                      ? 'bg-rose-600 hover:bg-rose-700' 
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  <Send className="w-4 h-4" />
                  {editingRxId 
                    ? 'Update & Resync Signed Prescription' 
                    : safetyWarnings.length > 0 
                    ? 'Sign & Sync (Safety Flag Active)' 
                    : 'Digitally Sign & Sync E-Prescription'}
                </button>
              </form>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 text-xs">
              Select a patient from the queue or click a signed citizen card from the left panel.
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CLINICAL HISTORY TIMELINE MODAL (ALL PAST ENCOUNTERS OF THIS CITIZEN)     */}
      {/* ========================================================================= */}
      {showHistoryModal && selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[88vh]">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 bg-slate-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-tight flex items-center gap-2">
                    <span>Clinical Consultations History</span>
                    <span className="text-[10px] px-2 py-0.5 bg-teal-500/20 text-teal-300 rounded font-bold">
                      {selectedCase.name}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Age: {selectedCase.age}y • Gender: {selectedCase.gender} • {selectedCase.village || 'Field Hub'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowHistoryModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              
              {/* CURRENT TRIAGE VITALS SNAPSHOT */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-rose-600" />
                    Latest Active Triage Vitals
                  </span>
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                    {selectedCase.lastTriage?.severity || selectedCase.severity || 'RED'}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                    <span>ASHA Field Readings:</span>
                    <span className="text-[10px] text-slate-400 font-semibold font-mono">
                      {formatSafeDate(selectedCase.lastTriage?.timestamp)}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center font-mono">
                    <div className="p-2 rounded-xl bg-white border border-slate-200 shadow-2xs">
                      <span className="block text-[8px] font-bold text-slate-400 uppercase">BP</span>
                      <span className="text-xs font-black text-slate-900">
                        {selectedCase.lastTriage?.bpSystolic ? `${selectedCase.lastTriage.bpSystolic}/${selectedCase.lastTriage.bpDiastolic || 80}` : (selectedCase.lastVitals?.bp || '120/80')}
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-white border border-slate-200 shadow-2xs">
                      <span className="block text-[8px] font-bold text-slate-400 uppercase">Pulse</span>
                      <span className="text-xs font-black text-slate-900">
                        {selectedCase.lastTriage?.pulse || selectedCase.lastVitals?.pulse || 72} bpm
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-white border border-slate-200 shadow-2xs">
                      <span className="block text-[8px] font-bold text-slate-400 uppercase">SpO2</span>
                      <span className="text-xs font-black text-slate-900">
                        {selectedCase.lastTriage?.spo2 || selectedCase.lastVitals?.spO2 || 98}%
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-white border border-slate-200 shadow-2xs">
                      <span className="block text-[8px] font-bold text-slate-400 uppercase">Temp</span>
                      <span className="text-xs font-black text-slate-900">
                        {selectedCase.lastTriage?.temp || selectedCase.lastVitals?.temp || 98.6}°F
                      </span>
                    </div>
                  </div>

                  {resolvedNotes && (
                    <p className="text-[11px] text-slate-600 italic bg-white p-2 rounded-xl border border-slate-200">
                      "{resolvedNotes}"
                    </p>
                  )}
                </div>
              </div>

              {/* ALL PREVIOUS CONSULTATIONS CHRONOLOGICAL LIST */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Doctor-Signed Consultations ({patientPastConsultations.length})
                  </h4>
                  <span className="text-[10px] text-slate-400 font-semibold">Chronological Timeline</span>
                </div>

                {patientPastConsultations.length === 0 ? (
                  <div className="py-8 px-4 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-1.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
                      <Pill className="w-4 h-4" />
                    </div>
                    <h5 className="text-xs font-black text-slate-800">No Prior Consultations Recorded</h5>
                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto leading-relaxed">
                      This citizen has not yet received a digitally signed prescription.
                    </p>
                  </div>
                ) : (
                  patientPastConsultations.map((rxItem, idx) => {
                    const rxKey = `past_rx_entry_${idx}_${rxItem._id || rxItem.timestamp}`;
                    const isRxOpen = Boolean(expandedRxMap[rxKey]);

                    return (
                      <div 
                        key={rxKey}
                        className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all space-y-3 shadow-2xs"
                      >
                        {/* Consultation Header */}
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                          <div>
                            <span className="text-xs font-black text-slate-900 block">
                              Consultation #{patientPastConsultations.length - idx}
                            </span>
                            <span className="text-[10px] text-slate-400 font-semibold font-mono">
                              {formatSafeDate(rxItem.timestamp)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                              By: {rxItem.doctorName || 'Medical Officer'}
                            </span>
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                              SIGNED
                            </span>
                          </div>
                        </div>

                        {/* Snapshot of Vitals at that consult */}
                        {rxItem.vitalsAtConsult && (
                          <div className="grid grid-cols-4 gap-1.5 text-center font-mono text-[10px]">
                            <div className="p-1 rounded-lg bg-slate-50 border border-slate-100">
                              <span className="text-slate-400 block text-[8px]">BP</span>
                              <strong className="text-slate-800">{rxItem.vitalsAtConsult.bp || '120/80'}</strong>
                            </div>
                            <div className="p-1 rounded-lg bg-slate-50 border border-slate-100">
                              <span className="text-slate-400 block text-[8px]">PULSE</span>
                              <strong className="text-slate-800">{rxItem.vitalsAtConsult.pulse || 72} bpm</strong>
                            </div>
                            <div className="p-1 rounded-lg bg-slate-50 border border-slate-100">
                              <span className="text-slate-400 block text-[8px]">SPO2</span>
                              <strong className="text-slate-800">{rxItem.vitalsAtConsult.spo2 || 98}%</strong>
                            </div>
                            <div className="p-1 rounded-lg bg-slate-50 border border-slate-100">
                              <span className="text-slate-400 block text-[8px]">TEMP</span>
                              <strong className="text-slate-800">{rxItem.vitalsAtConsult.temp || 98.6}°</strong>
                            </div>
                          </div>
                        )}

                        {/* Expandable Prescription Button */}
                        <button
                          type="button"
                          onClick={() => toggleExpandRx(rxKey)}
                          className={`w-full py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-between transition-all ${
                            isRxOpen 
                              ? 'bg-teal-600 text-white shadow-xs' 
                              : 'bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200'
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            <Pill className="w-3.5 h-3.5" />
                            <span>{isRxOpen ? 'Hide Prescription Details' : 'Show Prescription Details'}</span>
                          </span>
                          {isRxOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {/* Expanded Full Prescription Details */}
                        {isRxOpen && (
                          <div className="p-3.5 rounded-xl bg-slate-50/80 border border-teal-200 space-y-2.5 animate-fadeIn">
                            <div>
                              <span className="block text-[9px] font-black uppercase text-slate-400">Diagnosis Recorded:</span>
                              <p className="text-xs font-black text-teal-950 mt-0.5">{rxItem.diagnosis || 'Clinical Diagnosis'}</p>
                            </div>

                            <div>
                              <span className="block text-[9px] font-black uppercase text-slate-400">Medicines Prescribed:</span>
                              <div className="p-2.5 rounded-lg bg-white border border-slate-200 font-mono text-xs font-bold text-slate-900 whitespace-pre-line leading-relaxed shadow-2xs mt-0.5">
                                {rxItem.medicines || 'No medicines recorded.'}
                              </div>
                            </div>

                            {rxItem.advice && (
                              <div>
                                <span className="block text-[9px] font-black uppercase text-slate-400">Doctor Advice & Instructions:</span>
                                <p className="text-xs text-slate-700 bg-amber-50 p-2 rounded-lg border border-amber-200 font-medium mt-0.5">
                                  {rxItem.advice}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="px-5 py-2 text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 rounded-xl transition-all shadow-xs"
              >
                Close History
              </button>
            </div>

          </div>
        </div>
      )}

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