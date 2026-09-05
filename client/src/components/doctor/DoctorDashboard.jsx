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
  Square,
  History,
  Calendar,
  X,
  Activity,
  Pill,
  Edit3,
  PhoneCall,
  User,
  ShieldCheck,
  Baby
} from 'lucide-react';

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
    trigger: (p, vitals) => Boolean(p.isPregnant) && vitals.some(v => v.id === 'bp' && v.level !== 'GREEN'),
    diagnosis: 'Pre-eclampsia risk / Gestational Hypertension',
    medicines: 'Tab Labetalol 100mg BD x 7 days, Tab Calcium 500mg OD',
    advice: 'Immediate referral to District Hospital if BP > 150/100. Strict bed rest.'
  },
  {
    id: 'anc-routine',
    name: 'ANC Prophylaxis',
    gender: 'FEMALE',
    requiresPregnant: true,
    trigger: (p) => Boolean(p.isPregnant),
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

  const [incomingCallData, setIncomingCallData] = useState(null);

  const [editingRxId, setEditingRxId] = useState(null);
  const [expandedRxMap, setExpandedRxMap] = useState({});

  const [prescription, setPrescription] = useState({ diagnosis: '', medicines: '', advice: '' });
  const [appliedPresetIds, setAppliedPresetIds] = useState([]);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Field Voice Dictation
  const [activeDictationField, setActiveDictationField] = useState(null);
  const isRecordingIntentRef = useRef(false);
  const recognitionInstanceRef = useRef(null);
  const collectedTextRef = useRef('');

  const [playingRegAudio, setPlayingRegAudio] = useState(false);
  const [playingTriageAudio, setPlayingTriageAudio] = useState(false);
  const regAudioPlayerRef = useRef(null);
  const triageAudioPlayerRef = useRef(null);

  const playSoftChime = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch (e) {}
  };

  const cleanDoctorName = useMemo(() => {
    const raw = user?.name || 'Dr. Arvind Sharma (MO)';
    return raw.replace(/(\s*\(MO\))+/gi, '') + ' (MO)';
  }, [user?.name]);

  // Voice Dictation Toggle
  const toggleVoiceDictation = (fieldKey, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech Recognition is not supported on this browser. Please use Chrome or Edge.');
      return;
    }

    if (activeDictationField === fieldKey) {
      isRecordingIntentRef.current = false;
      if (recognitionInstanceRef.current) {
        try { recognitionInstanceRef.current.stop(); } catch (err) {}
      }

      const spoken = (collectedTextRef.current || '').trim();
      if (spoken) {
        setPrescription((prev) => {
          const oldText = (prev[fieldKey] || '').trim();
          if (!oldText) {
            return { ...prev, [fieldKey]: spoken };
          }
          return {
            ...prev,
            [fieldKey]: `${oldText}\n${spoken}`
          };
        });
      }

      collectedTextRef.current = '';
      setActiveDictationField(null);
      recognitionInstanceRef.current = null;
      return;
    }

    if (recognitionInstanceRef.current) {
      isRecordingIntentRef.current = false;
      try { recognitionInstanceRef.current.stop(); } catch (err) {}
      recognitionInstanceRef.current = null;
    }

    collectedTextRef.current = '';
    isRecordingIntentRef.current = true;
    setActiveDictationField(fieldKey);

    const initRecognition = () => {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-IN';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            collectedTextRef.current += (collectedTextRef.current ? ' ' : '') + event.results[i][0].transcript.trim();
          }
        }
      };

      recognition.onerror = (event) => {
        if (event.error === 'not-allowed') {
          alert('Microphone permission blocked hai! Address bar se mic allow karein.');
          isRecordingIntentRef.current = false;
          setActiveDictationField(null);
        }
      };

      recognition.onend = () => {
        if (isRecordingIntentRef.current) {
          try {
            recognition.start();
          } catch (err) {
            setTimeout(() => {
              if (isRecordingIntentRef.current) initRecognition();
            }, 100);
          }
        }
      };

      recognitionInstanceRef.current = recognition;
      try {
        recognition.start();
      } catch (err) {
        console.warn('Recognition start exception:', err);
      }
    };

    initRecognition();
  };

  useEffect(() => {
    return () => {
      isRecordingIntentRef.current = false;
      if (recognitionInstanceRef.current) {
        try { recognitionInstanceRef.current.stop(); } catch (e) {}
      }
    };
  }, []);

  // Vitals Scanner
  const activeAlertVitals = useMemo(() => {
    if (!selectedCase) return [];
    const t = selectedCase.lastTriage || selectedCase.triage || {};
    const v = selectedCase.lastVitals || selectedCase.vitals || {};
    const p = selectedCase;
    const cards = [];

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

  // Sidebar Unique Signed Patients
  const uniqueSignedPatients = useMemo(() => {
    const patientMap = new Map();
    completedPrescriptions.forEach((rx) => {
      const key = String(rx.patientId || '').trim();
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
        if (new Date(rx.timestamp || 0) > new Date(existing.latestRx.timestamp || 0)) {
          existing.latestRx = rx;
        }
      }
    });

    return Array.from(patientMap.values()).sort(
      (a, b) => new Date(b.latestRx.timestamp || 0) - new Date(a.latestRx.timestamp || 0)
    );
  }, [completedPrescriptions]);

  // Past Consultations
  const patientPastConsultations = useMemo(() => {
    if (!selectedCase) return [];
    const pid = String(selectedCase._id || selectedCase.id || '').trim();

    const matches = completedPrescriptions.filter((rx) => {
      const rxPid = String(rx.patientId || '').trim();
      return pid && rxPid && pid === rxPid;
    });

    const uniqueMap = new Map();
    matches.forEach((item) => {
      const uniqueKey = item._id || `${item.patientId}_${item.timestamp}_${item.diagnosis}`;
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

  const filteredPresets = useMemo(() => {
    if (!selectedCase) return [];
    return MASTER_PRESETS.filter((preset) => {
      if (isMale && (preset.gender === 'FEMALE' || preset.requiresPregnant)) return false;
      if (preset.requiresPregnant && !isPregnant) return false;
      return preset.trigger(selectedCase, activeAlertVitals);
    });
  }, [selectedCase, isMale, isPregnant, activeAlertVitals]);

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

  // Toggle Selection for Live Queue Patient
  const handleSelectPatient = (patient) => {
    const pid = String(patient?._id || patient?.id || '').trim();
    const currentPid = String(selectedCase?._id || selectedCase?.id || '').trim();

    if (regAudioPlayerRef.current) regAudioPlayerRef.current.pause();
    if (triageAudioPlayerRef.current) triageAudioPlayerRef.current.pause();
    setPlayingRegAudio(false);
    setPlayingTriageAudio(false);

    if (recognitionInstanceRef.current) {
      isRecordingIntentRef.current = false;
      try { recognitionInstanceRef.current.stop(); } catch (e) {}
    }
    setActiveDictationField(null);

    // Toggle Deselect
    if (currentPid && pid === currentPid && !editingRxId) {
      setSelectedCase(null);
      setEditingRxId(null);
      setPrescription({ diagnosis: '', medicines: '', advice: '' });
      setAppliedPresetIds([]);
      return;
    }

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

  // Toggle Selection for Signed Patient Card
  const handleOpenSignedPatient = (signedEntry) => {
    const entryKey = String(signedEntry.patientKey || '').trim();
    const currentPid = String(selectedCase?._id || selectedCase?.id || '').trim();

    if (regAudioPlayerRef.current) regAudioPlayerRef.current.pause();
    if (triageAudioPlayerRef.current) triageAudioPlayerRef.current.pause();
    setPlayingRegAudio(false);
    setPlayingTriageAudio(false);

    if (recognitionInstanceRef.current) {
      isRecordingIntentRef.current = false;
      try { recognitionInstanceRef.current.stop(); } catch (e) {}
    }
    setActiveDictationField(null);

    // Toggle Deselect
    if (currentPid && entryKey === currentPid) {
      setSelectedCase(null);
      setEditingRxId(null);
      setPrescription({ diagnosis: '', medicines: '', advice: '' });
      setAppliedPresetIds([]);
      return;
    }

    const rx = signedEntry.latestRx;
    const rxPid = String(rx.patientId || '');

    const foundPatient = allPatientsList.find(p => rxPid && String(p._id || p.id) === rxPid) || {
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

  const handleDeleteSignedCitizen = (e, signedEntry) => {
    e.stopPropagation();
    const key = signedEntry.patientKey;
    setCompletedPrescriptions((prev) => 
      prev.filter(item => String(item.patientId || '').trim() !== key)
    );

    if (selectedCase && String(selectedCase._id || selectedCase.id || '').trim() === key) {
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

  const safetyWarnings = useMemo(() => {
    if (!selectedCase || !prescription.medicines.trim()) return [];
    return SAFETY_RULES
      .filter((rule) => rule.match(prescription.medicines) && rule.applies(selectedCase))
      .map((rule) => ({ id: rule.id, message: rule.message(selectedCase) }));
  }, [selectedCase, prescription.medicines]);

  // Priority Queue Filter Rule
  const shouldBeInDoctorQueue = (p) => {
    if (!p) return false;
    const sev = String(p.severity || p.lastTriage?.severity || '').toUpperCase();
    return (
      sev.includes('RED') || 
      sev.includes('YELLOW') || 
      Boolean(p.isPregnant) || 
      p.status === 'QUEUED_FOR_TELEOPD' || 
      Boolean(p.teleConsultRequested)
    );
  };

  // Load Initial Doctor Data
  const loadDoctorData = async () => {
    setLoading(true);
    try {
      const [{ data: patients }, { data: rxList }] = await Promise.all([
        fetchPatientsApi(),
        fetchPrescriptionsApi()
      ]);

      setAllPatientsList(patients || []);

      const waiting = (patients || []).filter(shouldBeInDoctorQueue);
      setActiveQueue(waiting);

      setSelectedCase((prev) => {
        if (!prev) return null;
        const found = waiting.find((p) => (p._id || p.id) === (prev._id || prev.id));
        return found || prev;
      });

      const initialRx = rxList || [];
      const uniq = new Map();
      initialRx.forEach(item => {
        const key = item._id || `${item.patientId}_${item.timestamp}_${item.diagnosis}`;
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

  // ZERO-REFRESH REAL-TIME LISTENER: Socket + BroadcastChannel for ASHA Triage & Registration
  useEffect(() => {
    const handleIncomingPatientUpdate = (updatedPatient) => {
      if (!updatedPatient) return;
      const pid = String(updatedPatient._id || updatedPatient.id || '').trim();
      if (!pid) return;

      playSoftChime();

      setAllPatientsList((prev) => {
        const exists = prev.some(p => String(p._id || p.id).trim() === pid);
        if (exists) {
          return prev.map(p => String(p._id || p.id).trim() === pid ? { ...p, ...updatedPatient } : p);
        }
        return [updatedPatient, ...prev];
      });

      setActiveQueue((prev) => {
        const qualifies = shouldBeInDoctorQueue(updatedPatient);
        const filtered = prev.filter(p => String(p._id || p.id).trim() !== pid);

        if (qualifies) {
          return [{ ...updatedPatient, hasNewUpdate: true }, ...filtered];
        }
        return filtered;
      });

      setSelectedCase((prev) => {
        if (prev && String(prev._id || prev.id).trim() === pid) {
          return { ...prev, ...updatedPatient };
        }
        return prev;
      });
    };

    const handleIncomingPatientDelete = (deletedId) => {
      const dId = String(deletedId).trim();
      setAllPatientsList(prev => prev.filter(p => String(p._id || p.id).trim() !== dId));
      setActiveQueue(prev => prev.filter(p => String(p._id || p.id).trim() !== dId));
      setSelectedCase(prev => (prev && String(prev._id || prev.id).trim() === dId ? null : prev));
    };

    let teleChannel;
    try {
      teleChannel = new BroadcastChannel('swasthya_teleopd_channel');
      teleChannel.onmessage = (event) => {
        const { type, payload } = event.data || {};
        if (type === 'PATIENT_TRIAGE_UPDATED' || type === 'PATIENT_REGISTERED') {
          handleIncomingPatientUpdate(payload);
        }
      };
    } catch (e) {}

    if (socket) {
      socket.on('patient_queue_updated', handleIncomingPatientUpdate);
      socket.on('patient_deleted', handleIncomingPatientDelete);
    }

    return () => {
      if (teleChannel) teleChannel.close();
      if (socket) {
        socket.off('patient_queue_updated', handleIncomingPatientUpdate);
        socket.off('patient_deleted', handleIncomingPatientDelete);
      }
    };
  }, [socket]);

  const isMatchIncomingCall = (item) => {
    if (!incomingCallData?.patientId || !item || showVideoModal) return false;
    const incomingId = String(incomingCallData.patientId).trim();
    const currentItemId = String(item._id || item.id || item.patientId || '').trim();
    return Boolean(incomingId && currentItemId && incomingId === currentItemId);
  };

  // Incoming Call Signals
  useEffect(() => {
    let callChannel;
    try {
      callChannel = new BroadcastChannel('swasthya_teleconsult_channel');
      callChannel.onmessage = (event) => {
        const { type, payload } = event.data || {};
        if (type === 'TELE_CALL_REQUESTED' && payload?.patientId) {
          if (!showVideoModal) {
            setIncomingCallData(payload);
            playSoftChime();
          }

          const match = allPatientsList.find(p => 
            String(p._id || p.id).trim() === String(payload.patientId).trim()
          );
          if (match) setSelectedCase(match);
        } else if (type === 'CALL_TERMINATED') {
          setIncomingCallData(null);
        }
      };
    } catch (e) {}

    if (socket) {
      socket.on('tele_call_requested', (data) => {
        if (data?.patientId && !showVideoModal) {
          setIncomingCallData(data);
          playSoftChime();
        }
      });

      socket.on('call_terminated', () => {
        setIncomingCallData(null);
      });
    }

    return () => {
      if (callChannel) callChannel.close();
      if (socket) {
        socket.off('tele_call_requested');
        socket.off('call_terminated');
      }
    };
  }, [socket, allPatientsList, showVideoModal]);

  const handleDoctorAcceptCall = (targetPatient) => {
    const targetId = String(
      targetPatient?._id || 
      targetPatient?.id || 
      targetPatient?.patientId || 
      incomingCallData?.patientId || 
      selectedCase?._id || 
      ''
    ).trim();

    const patientObj = 
      (targetPatient && (targetPatient.name || targetPatient.patientName)) ? targetPatient :
      allPatientsList.find(p => String(p._id || p.id).trim() === targetId) ||
      selectedCase || {
        _id: targetId,
        id: targetId,
        name: incomingCallData?.patientName || 'Citizen',
        age: 26,
        gender: 'Female',
        village: 'Field Sub-Center'
      };

    setSelectedCase(patientObj);
    setIncomingCallData(null);
    setShowVideoModal(true);

    try {
      const callChannel = new BroadcastChannel('swasthya_teleconsult_channel');
      callChannel.postMessage({
        type: 'DOCTOR_JOINED_CALL',
        payload: { patientId: targetId }
      });
      callChannel.close();
    } catch (e) {}

    if (socket && targetId) {
      socket.emit('doctor_joined_call', { patientId: targetId });
    }
  };

  const handleDoctorRejectCall = (targetPatient, e) => {
    if (e) e.stopPropagation();
    const targetId = String(targetPatient?._id || targetPatient?.id || targetPatient?.patientId || incomingCallData?.patientId).trim();

    try {
      const callChannel = new BroadcastChannel('swasthya_teleconsult_channel');
      callChannel.postMessage({
        type: 'DOCTOR_BUSY_REJECT',
        payload: {
          patientId: targetId,
          reason: 'Dr. Arvind Sharma is currently attending to physical OPD queue.'
        }
      });
      callChannel.close();
    } catch (err) {}

    if (socket && targetId) {
      socket.emit('doctor_busy_reject', {
        patientId: targetId,
        reason: 'Doctor is occupied with OPD queue.'
      });
    }

    setIncomingCallData(null);
  };

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
        console.warn('API fallback:', apiErr);
      }

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

      try {
        const rxChan = new BroadcastChannel('swasthya_rx_channel');
        rxChan.postMessage({ type: 'RX_DISPATCHED', payload: savedRx });
        rxChan.close();
      } catch (bcErr) {}

      if (socket) socket.emit('prescription_dispatched', savedRx);

      try {
        await updatePatientApi(pid, { severity: 'LOW_GREEN', status: 'CONSULT_COMPLETED' });
      } catch (upErr) {}

      setEditingRxId(null);
      const remaining = activeQueue.filter((p) => (p._id || p.id) !== pid);
      setActiveQueue(remaining);
      setSelectedCase(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitted(false);
    }
  };

  const handleResolve = async (pid) => {
    try {
      await updatePatientApi(pid, { severity: 'LOW_GREEN' });
      setActiveQueue((prev) => prev.filter((p) => (p._id || p.id) !== pid));
    } catch (err) {}
  };

  const handleDelete = async (pid) => {
    try {
      await deletePatientApi(pid);
      setActiveQueue((prev) => prev.filter((p) => (p._id || p.id) !== pid));
    } catch (err) {}
  };

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

  const resolvedPhone = selectedCase?.phone || selectedCase?.mobile || selectedCase?.contact || 'Not Provided';
  const resolvedNotes = selectedCase?.fieldNotes || selectedCase?.lastTriage?.notes || selectedCase?.notes || 'No primary clinical notes recorded.';
  const resolvedRegistrationAudio = selectedCase?.registrationAudioNote || null;
  const resolvedTriageAudio = selectedCase?.triageAudioNote || selectedCase?.lastTriage?.triageAudioNote || null;
  const flaggedCount = activeAlertVitals.filter(c => c.level !== 'GREEN').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans">
      
      {/* FLOATING INCOMING NOTIFICATION BANNER */}
      {incomingCallData && !showVideoModal && (
        <div className="mb-6 p-4 rounded-3xl bg-amber-500 text-slate-950 border-2 border-amber-300 shadow-2xl flex items-center justify-between gap-4 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-950 text-amber-400 flex items-center justify-center shrink-0">
              <PhoneCall className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-900">
                Incoming Tele-Consult Request
              </p>
              <p className="text-sm font-black text-slate-950">
                ASHA is requesting consultation for <span className="underline decoration-slate-950">{incomingCallData.patientName}</span>
                <span className="font-mono font-bold text-xs ml-2 opacity-80">(ID: {incomingCallData.patientId})</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleDoctorAcceptCall()}
              className="px-4 py-2 bg-slate-950 hover:bg-slate-900 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow transition-all active:scale-95 cursor-pointer"
            >
              <Video className="w-3.5 h-3.5 text-emerald-400" />
              <span>Connect Call</span>
            </button>
            <button
              type="button"
              onClick={() => handleDoctorRejectCall()}
              className="px-3.5 py-2 bg-amber-600/30 hover:bg-amber-600/50 text-slate-950 border border-slate-900/20 rounded-xl text-xs font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Busy / Cut</span>
            </button>
          </div>
        </div>
      )}

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
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : ''}`} /> Refresh Queue
          </button>
          <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
            <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" /> Live Sync Active
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        
        {/* Left Side: Live Queue & Signed Citizens */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Live Queue */}
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
                  const isCalling = isMatchIncomingCall(item);
                  const itemIsPregnant = Boolean(item.isPregnant || item.gestationalWeeks);
                  const hasVoice = Boolean(item.registrationAudioNote || item.triageAudioNote || item.lastTriage?.triageAudioNote);

                  return (
                    <div
                      key={pid}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        isCalling
                          ? 'border-amber-400 bg-amber-50/70 ring-2 ring-amber-400/40'
                          : isSelected
                          ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20 shadow-sm'
                          : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/70'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div onClick={() => handleSelectPatient(item)} className="cursor-pointer flex-1 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-black text-slate-900">{item.name}</h4>
                            {item.hasNewUpdate && (
                              <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                              </span>
                            )}
                          </div>
                          
                          <p className="text-xs text-slate-500 font-medium">
                            {item.age}y, {item.gender} • {item.village || 'Field Sub-Center'}
                          </p>

                          {/* BADGES ON QUEUE CARD */}
                          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                            <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded-md ${
                              item.severity?.includes('RED') ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {item.severity?.replace('_', ' ') || 'QUEUED'}
                            </span>

                            {itemIsPregnant && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-pink-100 text-pink-800 text-[9px] font-black border border-pink-200">
                                <Baby className="w-2.5 h-2.5 text-pink-600" />
                                <span>ANC ({item.gestationalWeeks || '12'}w)</span>
                              </span>
                            )}

                            {hasVoice && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-teal-100 text-teal-800 text-[9px] font-bold">
                                <Volume2 className="w-2.5 h-2.5 text-teal-600" />
                                <span>Voice</span>
                              </span>
                            )}
                          </div>

                          {(item.fieldNotes || item.lastTriage?.notes) && (
                            <p className="text-[10px] text-slate-500 italic line-clamp-1 pt-0.5">
                              "{item.fieldNotes || item.lastTriage?.notes}"
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button onClick={() => handleResolve(pid)} className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded-lg cursor-pointer" title="Mark Resolved">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(pid)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-100 rounded-lg cursor-pointer" title="Archive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* CALL STRIP */}
                      {isCalling && (
                        <div className="mt-3 p-2.5 rounded-xl bg-white border border-amber-300 flex items-center justify-between gap-2 animate-fadeIn shadow-xs">
                          <div className="flex items-center gap-1.5">
                            <PhoneCall className="w-4 h-4 text-amber-600 animate-bounce" />
                            <div>
                              <p className="text-[10px] font-black text-amber-900 uppercase tracking-wide">
                                Tele-Call Requested
                              </p>
                              <p className="text-[9px] text-amber-700">ASHA waiting with patient</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleDoctorAcceptCall(item)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black flex items-center gap-1 shadow-xs cursor-pointer transition-all active:scale-95"
                            >
                              <Video className="w-3 h-3" /> Connect
                            </button>

                            <button
                              type="button"
                              onClick={(e) => handleDoctorRejectCall(item, e)}
                              className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-black flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                            >
                              <X className="w-3 h-3" /> Busy
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Signed Citizens List */}
          {uniqueSignedPatients.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Signed Patients ({uniqueSignedPatients.length})
                </h3>
                <span className="text-[9px] text-slate-400 font-bold">Tap to toggle</span>
              </div>

              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1.5 [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent]">
                {uniqueSignedPatients.map((entry) => {
                  const isSelected = selectedCase && 
                    String(selectedCase._id || selectedCase.id || '').trim() === entry.patientKey;
                  const isCalling = isMatchIncomingCall(entry);

                  return (
                    <div
                      key={entry.patientKey}
                      onClick={() => handleOpenSignedPatient(entry)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2 ${
                        isCalling
                          ? 'border-amber-400 bg-amber-50/80 ring-2 ring-amber-400'
                          : isSelected
                          ? 'border-teal-600 bg-teal-50/80 ring-2 ring-teal-500/30'
                          : 'border-slate-200 bg-slate-50 hover:bg-slate-100/80'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
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

                        <button
                          type="button"
                          onClick={(e) => handleDeleteSignedCitizen(e, entry)}
                          className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                          title="Delete Record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {isCalling && (
                        <div className="p-2 rounded-xl bg-white border border-amber-300 flex items-center justify-between gap-2 shadow-xs animate-fadeIn">
                          <span className="text-[10px] font-black text-amber-900 flex items-center gap-1">
                            <PhoneCall className="w-3.5 h-3.5 text-amber-600 animate-bounce" /> ASHA Calling
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDoctorAcceptCall(entry);
                              }}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg cursor-pointer"
                            >
                              Connect
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDoctorRejectCall(entry, e)}
                              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-bold rounded-lg cursor-pointer"
                            >
                              Busy
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Consultation Workspace */}
        <div className="lg:col-span-8 space-y-6">
          {selectedCase ? (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6 animate-fadeIn">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-black text-slate-900">{selectedCase.name}</h2>
                    
                    {/* MATERNAL ANC PREGNANCY BADGE */}
                    {isPregnant && (
                      <span className="px-3 py-1 rounded-full bg-pink-100 border-2 border-pink-300 text-pink-900 text-xs font-black flex items-center gap-1.5 shadow-2xs">
                        <Baby className="w-3.5 h-3.5 text-pink-600" />
                        PREGNANT / ANC HIGH-RISK ({selectedCase.gestationalWeeks || '15'}w)
                      </span>
                    )}

                    {editingRxId && (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-[10px] font-black flex items-center gap-1">
                        <Edit3 className="w-3 h-3" /> EDITING SIGNED RECORD
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-500 mt-1.5 flex items-center gap-2 flex-wrap">
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

                    {/* REGISTRATION AUDIO NOTE PLAYER */}
                    {resolvedRegistrationAudio && (
                      <>
                        <span>•</span>
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-teal-50 border border-teal-200 rounded-lg text-teal-800">
                          <Volume2 className="w-3.5 h-3.5 text-teal-600" />
                          <span className="text-[10px] font-bold">Reg. Voice:</span>
                          <button
                            type="button"
                            onClick={togglePlayRegAudio}
                            className="w-5 h-5 rounded-full bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center transition-all cursor-pointer"
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

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setShowHistoryModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    <History className="w-4 h-4 text-teal-600" />
                    <span>Clinical History ({patientPastConsultations.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAmbulanceModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    <Truck className="w-4 h-4 text-rose-600" /> Dispatch 108 FRU
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => {
                      const pid = String(selectedCase?._id || selectedCase?.id || '').trim();
                      
                      const callPayload = {
                        patientId: pid,
                        patientName: selectedCase?.name || 'Citizen',
                        doctorName: cleanDoctorName
                      };

                      try {
                        const callChannel = new BroadcastChannel('swasthya_teleconsult_channel');
                        callChannel.postMessage({
                          type: 'DOCTOR_CALL_INITIATED',
                          payload: callPayload
                        });
                        callChannel.close();
                      } catch (e) {}

                      if (socket && pid) {
                        socket.emit('doctor_call_initiated', callPayload);
                      }

                      setShowVideoModal(true);
                    }}
                    className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow transition-all cursor-pointer active:scale-95"
                  >
                    <Video className="w-4 h-4" /> Video Call
                  </button>
                </div>
              </div>

              {/* Dynamic Vitals Alert Strip */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    Triggered Clinical Vitals & Triage Findings
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${flaggedCount > 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
                    {flaggedCount > 0 ? `${flaggedCount} Abnormal Parameter(s)` : 'All Base Vitals Normal'}
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

              {/* Field Notes & Voice Notes Section */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowFieldNotes(!showFieldNotes)}
                  className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 text-left text-xs font-bold text-slate-700 cursor-pointer"
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

                    {/* FIELD TRIAGE AUDIO PLAYER */}
                    {resolvedTriageAudio ? (
                      <div className="p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={togglePlayTriageAudio}
                            className="w-7 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition-all cursor-pointer"
                          >
                            {playingTriageAudio ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                          </button>
                          <div>
                            <p className="text-xs font-bold text-emerald-950 flex items-center gap-1">
                              <Mic className="w-3 h-3 text-emerald-600" /> Field Triage Audio Note
                            </p>
                            <p className="text-[10px] text-emerald-700">Recorded live by ASHA during assessment</p>
                          </div>
                        </div>
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

              {/* Contextual Presets */}
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
                      className="text-[10px] text-slate-400 hover:text-rose-600 font-bold cursor-pointer"
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
                        className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
                          isApplied
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 border-slate-200'
                        }`}
                      >
                        {isApplied && <Check className="w-3 h-3" />}
                        <span>{p.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Prescription Form with Click-to-Speak Dictation */}
              <form onSubmit={handleCompleteConsult} className="space-y-4">
                
                {/* 1. Clinical Diagnosis */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">Clinical Diagnosis</label>
                    <button
                      type="button"
                      onClick={(e) => toggleVoiceDictation('diagnosis', e)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-black transition-all cursor-pointer select-none active:scale-95 ${
                        activeDictationField === 'diagnosis'
                          ? 'bg-rose-600 text-white animate-pulse shadow-md shadow-rose-600/30'
                          : 'bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 shadow-2xs'
                      }`}
                    >
                      {activeDictationField === 'diagnosis' ? (
                        <>
                          <Square className="w-2.5 h-2.5 fill-current" />
                          <span>Stop Recording</span>
                        </>
                      ) : (
                        <>
                          <Mic className="w-3 h-3 text-teal-600" />
                          <span>Voice Dictate</span>
                        </>
                      )}
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={prescription.diagnosis}
                    onChange={(e) => setPrescription({ ...prescription, diagnosis: e.target.value })}
                    className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none font-medium transition-all ${
                      activeDictationField === 'diagnosis'
                        ? 'border-rose-400 ring-2 ring-rose-200 bg-rose-50/20'
                        : 'border-slate-300 focus:ring-2 focus:ring-emerald-600'
                    }`}
                    placeholder="Type or click 'Voice Dictate' to speak diagnosis..."
                  />
                </div>

                {/* 2. Prescribed Medicines */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">Prescribed Medicines (Multi-dose list)</label>
                    <button
                      type="button"
                      onClick={(e) => toggleVoiceDictation('medicines', e)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-black transition-all cursor-pointer select-none active:scale-95 ${
                        activeDictationField === 'medicines'
                          ? 'bg-rose-600 text-white animate-pulse shadow-md shadow-rose-600/30'
                          : 'bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 shadow-2xs'
                      }`}
                    >
                      {activeDictationField === 'medicines' ? (
                        <>
                          <Square className="w-2.5 h-2.5 fill-current" />
                          <span>Stop Recording</span>
                        </>
                      ) : (
                        <>
                          <Mic className="w-3 h-3 text-teal-600" />
                          <span>Voice Dictate</span>
                        </>
                      )}
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    required
                    value={prescription.medicines}
                    onChange={(e) => setPrescription({ ...prescription, medicines: e.target.value })}
                    className={`w-full px-3 py-2 text-xs rounded-xl border font-mono focus:outline-none transition-all ${
                      activeDictationField === 'medicines'
                        ? 'border-rose-400 ring-2 ring-rose-200 bg-rose-50/20'
                        : 'border-slate-300 focus:ring-2 focus:ring-emerald-600'
                    }`}
                    placeholder="Click presets or speak: 'Tab Paracetamol 650mg TDS x 3 days'..."
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

                {/* 3. Advice & Follow-up */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">Advice & Follow-up</label>
                    <button
                      type="button"
                      onClick={(e) => toggleVoiceDictation('advice', e)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-black transition-all cursor-pointer select-none active:scale-95 ${
                        activeDictationField === 'advice'
                          ? 'bg-rose-600 text-white animate-pulse shadow-md shadow-rose-600/30'
                          : 'bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 shadow-2xs'
                      }`}
                    >
                      {activeDictationField === 'advice' ? (
                        <>
                          <Square className="w-2.5 h-2.5 fill-current" />
                          <span>Stop Recording</span>
                        </>
                      ) : (
                        <>
                          <Mic className="w-3 h-3 text-teal-600" />
                          <span>Voice Dictate</span>
                        </>
                      )}
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={prescription.advice}
                    onChange={(e) => setPrescription({ ...prescription, advice: e.target.value })}
                    className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none font-medium transition-all ${
                      activeDictationField === 'advice'
                        ? 'border-rose-400 ring-2 ring-rose-200 bg-rose-50/20'
                        : 'border-slate-300 focus:ring-2 focus:ring-emerald-600'
                    }`}
                    placeholder="Speak instructions: 'Drink plenty of water and steam inhalation twice daily'..."
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
                  className={`w-full py-2.5 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer ${
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
                    : 'Digitally Sign & Sync E-Prescription'}
                </button>
              </form>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200/90 p-12 text-center shadow-xs flex flex-col items-center justify-center min-h-[520px] space-y-4 animate-fadeIn">
              <div className="w-16 h-16 rounded-3xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 shadow-sm">
                <Stethoscope className="w-8 h-8 stroke-[1.8]" />
              </div>
              <div className="max-w-md space-y-1">
                <h3 className="text-base font-black text-slate-800 tracking-tight">
                  No Patient Selected
                </h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Select a case from the <strong>Live Queue</strong> to conduct clinical triage, or click any citizen from <strong>Signed Patients</strong> to review or update their digital prescription.
                </p>
              </div>
              <div className="flex items-center gap-2 pt-2 text-[11px] font-bold text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Workdesk Ready • Live Tele-OPD Standby</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Clinical History Modal */}
      {showHistoryModal && selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[88vh]">
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
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Doctor-Signed Consultations ({patientPastConsultations.length})
                </h4>

                {patientPastConsultations.length === 0 ? (
                  <div className="py-8 px-4 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-1.5">
                    <p className="text-xs font-bold text-slate-600">No Prior Consultations Recorded</p>
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
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                          <div>
                            <span className="text-xs font-black text-slate-900 block">
                              Consultation #{patientPastConsultations.length - idx}
                            </span>
                            <span className="text-[10px] text-slate-400 font-semibold font-mono">
                              {formatSafeDate(rxItem.timestamp)}
                            </span>
                          </div>
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            SIGNED
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleExpandRx(rxKey)}
                          className="w-full py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-between bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 cursor-pointer"
                        >
                          <span>{isRxOpen ? 'Hide Details' : 'Show Details'}</span>
                          {isRxOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {isRxOpen && (
                          <div className="p-3 rounded-xl bg-slate-50 border border-teal-200 space-y-2 text-xs">
                            <p><strong>Diagnosis:</strong> {rxItem.diagnosis}</p>
                            <p className="font-mono whitespace-pre-line"><strong>Medicines:</strong><br />{rxItem.medicines}</p>
                            {rxItem.advice && <p><strong>Advice:</strong> {rxItem.advice}</p>}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
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
      {showVideoModal && (
        <TeleConsultModal
          patient={selectedCase || {
            _id: incomingCallData?.patientId || 'session_call',
            id: incomingCallData?.patientId || 'session_call',
            name: incomingCallData?.patientName || 'Citizen',
            age: 26,
            gender: 'Female',
            village: 'Field Sub-Center'
          }}
          isDoctor={true}
          onClose={() => {
            setShowVideoModal(false);
            setIncomingCallData(null);
          }}
          onEndCall={() => {
            setShowVideoModal(false);
            setIncomingCallData(null);
          }}
        />
      )}
    </div>
  );
}