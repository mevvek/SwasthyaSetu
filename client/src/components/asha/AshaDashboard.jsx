import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useSocket } from '../../context/SocketContext';
import { db } from '../../db/offlineDb';
import { useNetworkSync } from '../../utils/useNetworkSync';
import { useSpeechRecognition } from '../../utils/useSpeechRecognition';
import { 
  deletePatientApi, 
  updatePatientApi, 
  createPatientApi,
  fetchPrescriptionsApi
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
  Trash2,
  Heart,
  Thermometer,
  Calendar,
  Square,
  Play,
  Pause,
  Volume2,
  History,
  Clock,
  Shield,
  Stethoscope
} from 'lucide-react';
import TriageAssessmentModal from './TriageAssessmentModal';
import AbhaCardModal from './AbhaCardModal';
import TeleConsultModal from '../doctor/TeleConsultModal';

const formatSafeDate = (rawDate, lang = 'en') => {
  if (!rawDate) return lang === 'hi' ? 'हाल ही में' : 'Recently';
  const d = new Date(rawDate);
  if (isNaN(d.getTime())) return lang === 'hi' ? 'हाल ही में' : 'Recently';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + d.toLocaleDateString();
};

export default function AshaDashboard() {
  const { t = {}, lang = 'en' } = useLanguage() || {};
  const { socket } = useSocket() || {};
  const { isSyncing, pendingCount = 0 } = useNetworkSync() || {};
  const { isListening, transcript, startListening, stopListening } = useSpeechRecognition() || {};

  const [patients, setPatients] = useState([]);
  const [allGlobalPrescriptions, setAllGlobalPrescriptions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [patientToDelete, setPatientToDelete] = useState(null);

  const [selectedPatientForTriage, setSelectedPatientForTriage] = useState(null);
  const [selectedPatientForAbha, setSelectedPatientForAbha] = useState(null);
  const [selectedPatientForTele, setSelectedPatientForTele] = useState(null);
  
  // Doctor incoming call notification
  const [doctorIncomingCall, setDoctorIncomingCall] = useState(null);

  // Real-time prescription state
  const [selectedRxPatient, setSelectedRxPatient] = useState(null);
  const [selectedRxIndex, setSelectedRxIndex] = useState(0);
  const [patientRxHistoryList, setPatientRxHistoryList] = useState([]);
  const [liveRxAlert, setLiveRxAlert] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gender: 'Female',
    village: '',
    phone: '',
    abhaId: '',
    isPregnant: false,
    gestationalWeeks: '',
    fieldNotes: '',
    registrationDate: new Date().toISOString().split('T')[0]
  });

  // Audio Recording States
  const [regAudioBase64, setRegAudioBase64] = useState(null);
  const [isAudioRecording, setIsAudioRecording] = useState(false);
  const [audioSeconds, setAudioSeconds] = useState(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const audioRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioTimerRef = useRef(null);
  const audioPlayerRef = useRef(null);
  const audioStreamRef = useRef(null);

  const playDoctorCallChime = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.6);
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (selectedPatientForTele) {
      if (isListening && stopListening) {
        stopListening();
      }
      if (audioRecorderRef.current && isAudioRecording) {
        stopRegistrationAudio();
      }
    }
  }, [selectedPatientForTele, isListening, isAudioRecording]);

  useEffect(() => {
    if (transcript) {
      setFormData((prev) => ({
        ...prev,
        fieldNotes: prev.fieldNotes ? `${prev.fieldNotes} ${transcript}` : transcript
      }));
    }
  }, [transcript]);

  useEffect(() => {
    return () => {
      if (audioTimerRef.current) clearInterval(audioTimerRef.current);
      if (audioRecorderRef.current && audioRecorderRef.current.state === 'recording') {
        audioRecorderRef.current.stop();
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => {
          track.stop();
          track.enabled = false;
        });
        audioStreamRef.current = null;
      }
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      if (isListening && stopListening) {
        stopListening();
      }
    };
  }, []);

  const startRegistrationAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      audioRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          setRegAudioBase64(reader.result);
        };

        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach(track => {
            track.stop();
            track.enabled = false;
          });
          audioStreamRef.current = null;
        }
      };

      mediaRecorder.start(250);
      setIsAudioRecording(true);
      setAudioSeconds(0);

      audioTimerRef.current = setInterval(() => {
        setAudioSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone error:', err);
      alert(lang === 'hi' ? 'माइक अनुमति आवश्यक है।' : 'Microphone permission is required.');
    }
  };

  const stopRegistrationAudio = () => {
    if (audioRecorderRef.current && isAudioRecording) {
      audioRecorderRef.current.stop();
      setIsAudioRecording(false);
      if (audioTimerRef.current) clearInterval(audioTimerRef.current);
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
      audioStreamRef.current = null;
    }
  };

  const deleteRegistrationAudio = () => {
    if (audioPlayerRef.current) audioPlayerRef.current.pause();
    setIsPlayingAudio(false);
    setRegAudioBase64(null);
    setAudioSeconds(0);
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
      audioStreamRef.current = null;
    }
  };

  const togglePlayAudio = () => {
    if (!audioPlayerRef.current) return;
    if (isPlayingAudio) {
      audioPlayerRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioPlayerRef.current.play().then(() => setIsPlayingAudio(true)).catch(() => setIsPlayingAudio(false));
    }
  };

  const loadPatientsAndRx = async () => {
    try {
      if (db?.patients) {
        const records = await db.patients.toArray();
        if (records && records.length > 0) {
          setPatients(records);
        }
      }
      try {
        const { data: rxList } = await fetchPrescriptionsApi();
        if (Array.isArray(rxList)) {
          setAllGlobalPrescriptions(rxList);
        }
      } catch (e) {
        console.warn('API rx list sync fallback:', e);
      }
    } catch (err) {
      console.error('Local DB error:', err);
    }
  };

  useEffect(() => {
    loadPatientsAndRx();
  }, []);

  // Doctor incoming call notification
  useEffect(() => {
    let callChannel;
    try {
      callChannel = new BroadcastChannel('swasthya_teleconsult_channel');
      callChannel.onmessage = (event) => {
        const { type, payload } = event.data || {};
        if (type === 'DOCTOR_CALL_INITIATED' && payload?.patientId) {
          setDoctorIncomingCall(payload);
          playDoctorCallChime();
        } else if (type === 'CALL_TERMINATED') {
          setDoctorIncomingCall(null);
        }
      };
    } catch (e) {}

    if (socket) {
      socket.on('doctor_call_initiated', (data) => {
        if (data?.patientId) {
          setDoctorIncomingCall(data);
          playDoctorCallChime();
        }
      });

      socket.on('call_terminated', () => {
        setDoctorIncomingCall(null);
      });
    }

    return () => {
      if (callChannel) callChannel.close();
      if (socket) {
        socket.off('doctor_call_initiated');
        socket.off('call_terminated');
      }
    };
  }, [socket]);

  useEffect(() => {
    const handleIncomingPrescription = (rxData) => {
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
      setAllGlobalPrescriptions((prev) => [rxData, ...prev.filter(p => p._id !== rxData._id)]);

      setPatients((prev) =>
        prev.map((p) => {
          const pid = p._id || p.id;
          const rxPid = rxData.patientId || rxData._id || rxData.id;
          const match = (pid && rxPid && String(pid) === String(rxPid)) || 
                        (p.name && rxData.patientName && p.name.trim().toLowerCase() === rxData.patientName.trim().toLowerCase());

          if (match) {
            const oldHistory = Array.isArray(p.prescriptionHistory) ? p.prescriptionHistory : (p.prescription ? [p.prescription] : []);
            const updatedHistory = [rxData, ...oldHistory.filter(h => h.timestamp !== rxData.timestamp && h._id !== rxData._id)];
            
            const updated = { 
              ...p, 
              prescription: rxData,
              prescriptionHistory: updatedHistory
            };
            if (db?.patients) db.patients.put(updated).catch(() => {});
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

  const handleOpenPrescriptionModal = async (patient) => {
    setSelectedRxPatient(patient);
    setSelectedRxIndex(0);

    const pid = String(patient._id || patient.id || '').trim();
    const pName = String(patient.name || '').trim().toLowerCase();

    let matched = allGlobalPrescriptions.filter(rx => {
      const rxPid = String(rx.patientId || '').trim();
      const rxPName = String(rx.patientName || '').trim().toLowerCase();
      return (pid && rxPid === pid) || (pName && rxPName === pName);
    });

    if (matched.length === 0) {
      if (Array.isArray(patient.prescriptionHistory) && patient.prescriptionHistory.length > 0) {
        matched = [...patient.prescriptionHistory];
      } else if (patient.prescription) {
        matched = [patient.prescription];
      }
    }

    try {
      const { data: freshList } = await fetchPrescriptionsApi();
      if (Array.isArray(freshList)) {
        setAllGlobalPrescriptions(freshList);
        const freshMatched = freshList.filter(rx => {
          const rxPid = String(rx.patientId || '').trim();
          const rxPName = String(rx.patientName || '').trim().toLowerCase();
          return (pid && rxPid === pid) || (pName && rxPName === pName);
        });
        if (freshMatched.length > 0) matched = freshMatched;
      }
    } catch (e) {
      console.warn(e);
    }

    const uniq = new Map();
    matched.forEach(item => {
      if (!item) return;
      const k = item._id || `${item.timestamp}_${item.diagnosis}`;
      if (!uniq.has(k)) uniq.set(k, item);
    });

    const finalList = Array.from(uniq.values()).sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
    setPatientRxHistoryList(finalList);
  };

  const handleOpenEdit = (patient) => {
    setEditingPatient(patient);
    setFormData({
      name: patient.name || '',
      age: patient.age || '',
      gender: patient.gender || 'Female',
      village: patient.village || '',
      phone: patient.phone || '',
      abhaId: patient.abhaId || '',
      isPregnant: Boolean(patient.isPregnant),
      gestationalWeeks: patient.gestationalWeeks || '',
      fieldNotes: patient.fieldNotes || '',
      registrationDate: patient.registrationDate || patient.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0]
    });
    setRegAudioBase64(patient.registrationAudioNote || null);
    setIsRegisterOpen(true);
  };

  const handleRegisterOrEditSubmit = async (e) => {
    e.preventDefault();

    const isFem = formData.gender === 'Female';
    const finalIsPregnant = isFem ? Boolean(formData.isPregnant) : false;
    const finalWeeks = (isFem && finalIsPregnant && formData.gestationalWeeks) ? Number(formData.gestationalWeeks) : null;

    if (editingPatient) {
      const pid = editingPatient._id || editingPatient.id;
      const updatedCitizen = {
        ...editingPatient,
        ...formData,
        age: Number(formData.age),
        isPregnant: finalIsPregnant,
        gestationalWeeks: finalWeeks,
        registrationAudioNote: regAudioBase64,
        synced: true
      };

      try {
        if (db?.patients) await db.patients.put(updatedCitizen);
        try { await updatePatientApi(pid, updatedCitizen); } catch (e) {}

        if (socket) socket.emit('patient_queue_updated', updatedCitizen);

        try {
          const bc = new BroadcastChannel('swasthya_teleopd_channel');
          bc.postMessage({ type: 'PATIENT_TRIAGE_UPDATED', payload: updatedCitizen });
          bc.close();
        } catch (bcErr) {}

        setPatients((prev) => prev.map(p => (p._id || p.id) === pid ? updatedCitizen : p));
        setIsRegisterOpen(false);
        setEditingPatient(null);
      } catch (err) {
        console.error(err);
      }
    } else {
      const tempId = `pat_${Date.now()}`;
      const newCitizen = {
        id: tempId,
        _id: tempId,
        ...formData,
        age: Number(formData.age),
        isPregnant: finalIsPregnant,
        gestationalWeeks: finalWeeks,
        registrationAudioNote: regAudioBase64,
        severity: finalIsPregnant ? 'MODERATE_YELLOW' : 'LOW_GREEN',
        lastTriage: null,
        prescription: null,
        prescriptionHistory: [],
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
        } catch (e) {}

        if (db?.patients) await db.patients.add(newCitizen);
        if (socket) socket.emit('patient_queue_updated', newCitizen);

        try {
          const bc = new BroadcastChannel('swasthya_teleopd_channel');
          bc.postMessage({ type: 'PATIENT_TRIAGE_UPDATED', payload: newCitizen });
          bc.close();
        } catch (bcErr) {}

        setPatients((prev) => [newCitizen, ...prev]);
        setIsRegisterOpen(false);
      } catch (err) {
        console.error(err);
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
      fieldNotes: '',
      registrationDate: new Date().toISOString().split('T')[0]
    });
    setRegAudioBase64(null);
  };

  const confirmDeleteCitizen = async () => {
    if (!patientToDelete) return;
    const pid = patientToDelete._id || patientToDelete.id;
    try {
      if (db?.patients) await db.patients.delete(pid);
      try { await deletePatientApi(pid); } catch (e) {}
      if (socket) socket.emit('patient_deleted', pid);
      setPatients((prev) => prev.filter(p => (p._id || p.id) !== pid));
      setPatientToDelete(null);
    } catch (err) {
      console.error(err);
    }
  };

  const stats = useMemo(() => {
    const total = patients.length;
    const critical = patients.filter(p => p.severity === 'CRITICAL_RED' || p.lastTriage?.severity === 'RED').length;
    const maternal = patients.filter(p => p.isPregnant).length;
    const rxActive = patients.filter(p => p.prescription || (p.prescriptionHistory && p.prescriptionHistory.length > 0)).length;
    return { total, critical, maternal, rxActive };
  }, [patients]);

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
        <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-500 text-[10px] font-bold border border-slate-200 flex items-center gap-1">
          <Clock className="w-3 h-3 text-slate-400" />
          {lang === 'hi' ? 'ट्रायज लंबित' : 'Pending Triage'}
        </span>
      );
    }
    if (sev === 'CRITICAL_RED' || sev === 'RED') {
      return (
        <span className="px-2.5 py-1 rounded-xl bg-rose-50 text-rose-700 text-[10px] font-black border border-rose-200 flex items-center gap-1.5 shadow-2xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
          </span>
          {lang === 'hi' ? 'गंभीर (रेड)' : 'Critical Red'}
        </span>
      );
    }
    if (sev === 'MODERATE_YELLOW' || sev === 'YELLOW') {
      return (
        <span className="px-2.5 py-1 rounded-xl bg-amber-50 text-amber-700 text-[10px] font-black border border-amber-200 flex items-center gap-1 shadow-2xs">
          <Activity className="w-3 h-3 text-amber-600 animate-pulse" />
          {lang === 'hi' ? 'मध्यम (येलो)' : 'Moderate'}
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 text-[10px] font-black border border-emerald-200 flex items-center gap-1 shadow-2xs">
        <Activity className="w-3 h-3 text-emerald-600" />
        {lang === 'hi' ? 'सामान्य (ग्रीन)' : 'Normal Green'}
      </span>
    );
  };

  const activeRx = patientRxHistoryList[selectedRxIndex] || patientRxHistoryList[0] || selectedRxPatient?.prescription || null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 space-y-6 font-sans">
      
      {/* DOCTOR CALLING ASHA INCOMING BANNER */}
      {doctorIncomingCall && !selectedPatientForTele && (
        <div className="p-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-3xl shadow-2xl border-2 border-emerald-300 flex items-center justify-between gap-4 animate-bounce">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white text-teal-700 flex items-center justify-center shrink-0 shadow-md">
              <Video className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-100">
                {lang === 'hi' ? 'चिकित्सा अधिकारी द्वारा वीडियो परामर्श कॉल' : 'Doctor Initiated Tele-Consultation'}
              </p>
              <p className="text-sm font-black text-white">
                {doctorIncomingCall.doctorName || 'Doctor'} {lang === 'hi' ? 'ने' : 'is calling for'}{' '}
                <span className="underline decoration-white decoration-2">{doctorIncomingCall.patientName}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                const matched = patients.find(p => String(p._id || p.id).trim() === String(doctorIncomingCall.patientId).trim()) || {
                  _id: doctorIncomingCall.patientId,
                  id: doctorIncomingCall.patientId,
                  name: doctorIncomingCall.patientName
                };
                setSelectedPatientForTele(matched);
                setDoctorIncomingCall(null);
              }}
              className="px-4 py-2 bg-white hover:bg-emerald-50 text-teal-900 rounded-xl text-xs font-black flex items-center gap-1.5 shadow transition-all active:scale-95 cursor-pointer"
            >
              <Video className="w-3.5 h-3.5 text-teal-700" />
              <span>{lang === 'hi' ? 'कॉल स्वीकारें' : 'Accept Call'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                try {
                  const ch = new BroadcastChannel('swasthya_teleconsult_channel');
                  ch.postMessage({ type: 'CALL_TERMINATED', payload: { patientId: doctorIncomingCall.patientId } });
                  ch.close();
                } catch (e) {}
                if (socket) socket.emit('call_terminated', { patientId: doctorIncomingCall.patientId });
                setDoctorIncomingCall(null);
              }}
              className="px-3 py-2 bg-teal-900/40 hover:bg-teal-900/60 text-white border border-white/20 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>{lang === 'hi' ? 'अस्वीकार' : 'Decline'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Real-time Notification Banner from Doctor for Signed Prescription */}
      {liveRxAlert && (
        <div className="p-4 bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 border-2 border-emerald-400 text-white rounded-3xl shadow-2xl flex items-center justify-between gap-4 animate-bounce">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/40">
              <Pill className="w-5 h-5 animate-spin" />
            </div>
            <div>
              <p className="text-[11px] font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                {lang === 'hi' ? 'डॉक्टर द्वारा डिजिटल पर्ची जारी' : 'Digital Prescription Dispatched by Doctor'}
              </p>
              <p className="text-sm font-bold text-white mt-0.5">
                {lang === 'hi' ? (
                  <>
                    {liveRxAlert.doctorName || 'चिकित्सा अधिकारी'} ने <span className="underline decoration-emerald-400 decoration-2">{liveRxAlert.patientName}</span> के लिए डिजिटल पर्ची भेजी है।
                  </>
                ) : (
                  <>
                    {liveRxAlert.doctorName || 'Medical Officer'} has issued prescription for <span className="underline decoration-emerald-400 decoration-2">{liveRxAlert.patientName}</span>.
                  </>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              const matched = patients.find(p => (p._id || p.id) === (liveRxAlert.patientId || liveRxAlert.id) || p.name === liveRxAlert.patientName);
              handleOpenPrescriptionModal(matched || { name: liveRxAlert.patientName, prescription: liveRxAlert });
              setLiveRxAlert(null);
            }}
            className="px-4 py-2 bg-emerald-400 hover:bg-emerald-300 active:scale-95 text-slate-950 font-black text-xs rounded-xl transition-all shrink-0 shadow-md cursor-pointer"
          >
            {lang === 'hi' ? 'पर्ची देखें' : 'View Rx'}
          </button>
        </div>
      )}

      {/* Hero Header & Quick Stats */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm hover:shadow-md transition-all space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center shadow-md shadow-teal-600/25">
                <Heart className="w-5 h-5 fill-current animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-black tracking-tight text-slate-900">
                    {lang === 'hi' ? (t?.ashaDeskTitle || 'नागरिक स्वास्थ्य पंजी') : 'Frontline Clinical Registry'}
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-700 text-[10px] font-extrabold uppercase tracking-wide">
                    {lang === 'hi' ? 'उप-केंद्र डेस्क' : 'Sub-Center Desk'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {lang === 'hi' ? (t?.ashaDeskSub || 'आयुष्मान भारत डिजिटल मिशन • ग्रामीण टेली-परामर्श केंद्र') : 'Ayushman Bharat Digital Health Mission • Rural Tele-OPD Field Unit'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {pendingCount > 0 ? (
              <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold animate-pulse">
                <CloudOff className="w-4 h-4 text-amber-600" />
                <span>{pendingCount} {lang === 'hi' ? (t?.pendingSync || 'सिंक लंबित') : 'Pending Sync'}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shadow-2xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>{lang === 'hi' ? (t?.syncStatus || 'क्लाउड सिंक सक्रिय') : 'Cloud Synced'}</span>
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
                  fieldNotes: '',
                  registrationDate: new Date().toISOString().split('T')[0]
                });
                setRegAudioBase64(null);
                setIsRegisterOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 active:scale-95 text-white font-bold text-xs shadow-md shadow-teal-600/30 transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>{lang === 'hi' ? (t?.registerCitizenBtn || '+ नया नागरिक पंजीकृत करें') : '+ Register New Citizen'}</span>
            </button>
          </div>
        </div>

        {/* Quick KPI Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
          <div className="p-3 bg-slate-50/80 hover:bg-slate-100 rounded-2xl border border-slate-100 flex items-center justify-between transition-all">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                {lang === 'hi' ? 'कुल नागरिक' : 'Total Citizens'}
              </span>
              <span className="text-base font-black text-slate-900">{stats.total}</span>
            </div>
            <Users className="w-5 h-5 text-slate-400" />
          </div>

          <div className="p-3 bg-rose-50/60 hover:bg-rose-50 rounded-2xl border border-rose-100 flex items-center justify-between transition-all">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 block">
                {lang === 'hi' ? 'गंभीर ट्रायज' : 'Critical Triage'}
              </span>
              <span className="text-base font-black text-rose-700">{stats.critical}</span>
            </div>
            <AlertTriangle className="w-5 h-5 text-rose-500" />
          </div>

          <div className="p-3 bg-pink-50/60 hover:bg-pink-50 rounded-2xl border border-pink-100 flex items-center justify-between transition-all">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-pink-500 block">
                {lang === 'hi' ? 'मातृ स्वास्थ्य (ANC)' : 'High-Risk ANC'}
              </span>
              <span className="text-base font-black text-pink-700">{stats.maternal}</span>
            </div>
            <Baby className="w-5 h-5 text-pink-500" />
          </div>

          <div className="p-3 bg-teal-50/60 hover:bg-teal-50 rounded-2xl border border-teal-100 flex items-center justify-between transition-all">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 block">
                {lang === 'hi' ? 'दवा पर्ची जारी' : 'Rx Signed'}
              </span>
              <span className="text-base font-black text-teal-800">{stats.rxActive}</span>
            </div>
            <Pill className="w-5 h-5 text-teal-600" />
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={lang === 'hi' ? (t?.searchPlaceholder || 'नाम, मोबाइल या आभा संख्या से खोजें...') : 'Search citizens by name, phone or ABHA ID...'}
            className="w-full pl-10 pr-4 py-2.5 text-xs rounded-2xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600 shadow-2xs font-medium text-slate-900"
          />
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-2xl shadow-2xs w-full sm:w-auto overflow-x-auto">
          {[
            { id: 'ALL', label: lang === 'hi' ? (t?.allSeverity || 'सभी केस') : 'All Cases' },
            { id: 'RED', label: lang === 'hi' ? (t?.criticalFilter || '🔴 गंभीर') : '🔴 Critical' },
            { id: 'YELLOW', label: lang === 'hi' ? (t?.moderateFilter || '🟡 मध्यम') : '🟡 Moderate' },
            { id: 'GREEN', label: lang === 'hi' ? (t?.normalFilter || '🟢 सामान्य') : '🟢 Normal' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSeverityFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                severityFilter === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Citizen Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredPatients.map((patient) => {
          const pid = patient._id || patient.id;
          const triage = patient.lastTriage;

          const pName = String(patient.name || '').trim().toLowerCase();
          const matchCount = allGlobalPrescriptions.filter(rx => 
            (pid && String(rx.patientId) === String(pid)) || 
            (String(rx.patientName || '').trim().toLowerCase() === pName)
          ).length || (patient.prescription ? 1 : 0);

          const initials = (patient.name || 'C')
            .split(' ')
            .map(n => n[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();

          const isCurrentActiveCall = selectedPatientForTele && String(selectedPatientForTele._id || selectedPatientForTele.id).trim() === String(pid).trim();
          const isAnotherCallActive = selectedPatientForTele && String(selectedPatientForTele._id || selectedPatientForTele.id).trim() !== String(pid).trim();

          return (
            <div 
              key={pid}
              className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-sm hover:shadow-xl hover:border-teal-200 transition-all duration-300 flex flex-col justify-between space-y-4 relative overflow-hidden group hover:-translate-y-1"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs shrink-0 shadow-2xs ${
                      patient.isPregnant 
                        ? 'bg-gradient-to-tr from-pink-500 to-rose-400 text-white ring-2 ring-pink-200 shadow-pink-200' 
                        : 'bg-gradient-to-tr from-teal-600 to-emerald-500 text-white shadow-teal-100'
                    }`}>
                      {initials}
                    </div>

                    <div>
                      <h3 className="text-base font-black text-slate-900 leading-tight group-hover:text-teal-700 transition-colors">
                        {patient.name}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-0.5">
                        <span>
                          {patient.gender === 'Female' ? (lang === 'hi' ? 'महिला' : 'Female') : patient.gender === 'Male' ? (lang === 'hi' ? 'पुरुष' : 'Male') : patient.gender}, {patient.age} {lang === 'hi' ? 'वर्ष' : 'y'}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 truncate max-w-[125px]">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          {patient.village || (lang === 'hi' ? 'ग्रामीण केंद्र' : 'Field Village')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(patient)}
                      className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-xl transition-all cursor-pointer"
                      title={lang === 'hi' ? 'विवरण संपादित करें' : 'Edit Details'}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPatientToDelete(patient)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                      title={lang === 'hi' ? 'रिकॉर्ड हटाएं' : 'Delete Citizen'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {patient.synced ? (
                      <span className="text-emerald-600 ml-0.5" title={lang === 'hi' ? 'सिंक हुआ' : 'Synced'}>
                        <CloudCheck className="w-4 h-4" />
                      </span>
                    ) : (
                      <span className="text-amber-500 animate-pulse ml-0.5" title={lang === 'hi' ? 'सिंक लंबित' : 'Pending Sync'}>
                        <CloudOff className="w-4 h-4" />
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {patient.isPregnant && (
                    <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-pink-50 border border-pink-200 text-pink-700 text-[10px] font-bold">
                      <Baby className="w-3 h-3 text-pink-600" />
                      <span>{lang === 'hi' ? (t?.maternalBadge || 'गर्भवती / ANC') : 'ANC High-Risk'} ({patient.gestationalWeeks || '12'}w)</span>
                    </div>
                  )}

                  {patient.registrationAudioNote && (
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 text-[10px] font-bold">
                      <Volume2 className="w-3 h-3 text-teal-600" />
                      <span>{lang === 'hi' ? 'वॉयस नोट संलग्न' : 'Voice Attached'}</span>
                    </div>
                  )}
                </div>

                {matchCount > 0 && (
                  <div className="flex items-center justify-between p-2.5 rounded-2xl bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200/90 shadow-2xs">
                    <span className="text-[10px] font-black text-teal-900 flex items-center gap-1.5">
                      <Pill className="w-3.5 h-3.5 text-teal-600" />
                      <span>
                        {lang === 'hi' ? `डॉक्टर पर्ची तैयार (${matchCount} पर्ची)` : `Doctor Rx Ready (${matchCount} ${matchCount === 1 ? 'Slip' : 'Slips'})`}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenPrescriptionModal(patient)}
                      className="text-[10px] font-black text-teal-950 hover:text-teal-700 underline flex items-center gap-1 cursor-pointer"
                    >
                      <FileText className="w-3 h-3" />
                      <span>{lang === 'hi' ? 'सभी पर्ची देखें' : 'View All Slips'}</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-2 text-xs text-slate-600 font-medium">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">{lang === 'hi' ? 'फ़ोन नंबर:' : 'Phone Contact:'}</span>
                  <span className="font-bold text-slate-800">{patient.phone || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">{lang === 'hi' ? 'आभा संख्या:' : 'ABHA Health ID:'}</span>
                  <span className="font-mono font-bold text-teal-800 text-[11px]">
                    {patient.abhaId || (lang === 'hi' ? 'आभा लिंक नहीं' : 'ABHA Unlinked')}
                  </span>
                </div>

                {triage && (triage.spo2 || triage.bpSystolic || triage.pulse || triage.temp) ? (
                  <div className="pt-2 border-t border-slate-200/70 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                        {lang === 'hi' ? 'अंतिम वाइटल्स' : 'Latest Vitals'}
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono">
                        {triage.timestamp ? new Date(triage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 text-center font-mono">
                      {triage.spo2 ? (
                        <div className="p-1 rounded-xl bg-white border border-slate-200 shadow-2xs">
                          <span className="block text-[8px] font-bold text-slate-400 uppercase">SpO2</span>
                          <span className={`text-[11px] font-black ${Number(triage.spo2) < 94 ? 'text-rose-600' : 'text-slate-800'}`}>
                            {triage.spo2}%
                          </span>
                        </div>
                      ) : null}

                      {(triage.bpSystolic && triage.bpDiastolic) ? (
                        <div className="p-1 rounded-xl bg-white border border-slate-200 shadow-2xs">
                          <span className="block text-[8px] font-bold text-slate-400 uppercase">BP</span>
                          <span className={`text-[11px] font-black ${Number(triage.bpSystolic) >= 140 ? 'text-rose-600' : 'text-slate-800'}`}>
                            {triage.bpSystolic}/{triage.bpDiastolic}
                          </span>
                        </div>
                      ) : null}

                      {triage.pulse ? (
                        <div className="p-1 rounded-xl bg-white border border-slate-200 shadow-2xs">
                          <span className="block text-[8px] font-bold text-slate-400 uppercase">Pulse</span>
                          <span className="text-[11px] font-black text-slate-800">
                            {triage.pulse}
                          </span>
                        </div>
                      ) : null}

                      {triage.temp ? (
                        <div className="p-1 rounded-xl bg-white border border-slate-200 shadow-2xs">
                          <span className="block text-[8px] font-bold text-slate-400 uppercase">Temp</span>
                          <span className="text-[11px] font-black text-slate-800">
                            {triage.temp}°
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {patient.fieldNotes && (
                  <div className="pt-1.5 text-[11px] text-slate-500 italic border-t border-slate-200/60 line-clamp-1">
                    "{patient.fieldNotes}"
                  </div>
                )}
              </div>

              <div className="space-y-3 pt-1 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {lang === 'hi' ? 'ट्रायज स्तर' : 'Triage Level'}
                  </span>
                  {getTriagePill(patient)}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedPatientForTriage(patient)}
                    className="group/btn relative px-2.5 py-2.5 rounded-2xl bg-gradient-to-b from-teal-50 to-emerald-100/60 hover:from-teal-600 hover:to-emerald-600 text-teal-900 hover:text-white border border-teal-200/90 hover:border-teal-600 text-[11px] font-black transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95 shadow-xs hover:shadow-md hover:shadow-teal-600/20 hover:-translate-y-0.5 cursor-pointer"
                  >
                    <Activity className="w-3.5 h-3.5 text-teal-700 group-hover/btn:text-white transition-colors group-hover/btn:scale-110" />
                    <span>{lang === 'hi' ? (t?.btnTriage || 'ट्रायज') : 'Triage'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedPatientForAbha(patient)}
                    className="group/btn relative px-2.5 py-2.5 rounded-2xl bg-gradient-to-b from-indigo-50 to-slate-100 hover:from-indigo-600 hover:to-slate-800 text-indigo-950 hover:text-white border border-indigo-200/80 hover:border-indigo-600 text-[11px] font-black transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95 shadow-xs hover:shadow-md hover:shadow-indigo-600/20 hover:-translate-y-0.5 cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5 text-indigo-700 group-hover/btn:text-white transition-colors group-hover/btn:rotate-6" />
                    <span>{lang === 'hi' ? (t?.btnAbha || 'आभा कार्ड') : 'ABHA Pass'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={isAnotherCallActive}
                    onClick={() => {
                      if (isCurrentActiveCall) {
                        setSelectedPatientForTele(null);
                        try {
                          const ch = new BroadcastChannel('swasthya_teleconsult_channel');
                          ch.postMessage({ type: 'CALL_TERMINATED', payload: { patientId: pid } });
                          ch.close();
                        } catch (e) {}
                        if (socket) {
                          socket.emit('call_terminated', { patientId: pid });
                        }
                      } else {
                        setSelectedPatientForTele(patient);
                      }
                    }}
                    className={`group/btn relative px-2.5 py-2.5 rounded-2xl text-[11px] font-black transition-all duration-200 flex items-center justify-center gap-1.5 shadow-xs ${
                      isCurrentActiveCall
                        ? 'bg-amber-500 text-slate-950 border border-amber-600 ring-2 ring-amber-400/50 animate-pulse cursor-pointer'
                        : isAnotherCallActive
                        ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                        : 'bg-gradient-to-b from-sky-50 to-blue-100/70 hover:from-blue-600 hover:to-indigo-600 text-blue-950 hover:text-white border border-blue-200 hover:border-blue-600 hover:shadow-md hover:shadow-blue-600/20 hover:-translate-y-0.5 cursor-pointer active:scale-95'
                    }`}
                  >
                    <Video className={`w-3.5 h-3.5 transition-colors ${
                      isCurrentActiveCall 
                        ? 'text-slate-950 animate-bounce' 
                        : isAnotherCallActive 
                        ? 'text-slate-400' 
                        : 'text-blue-700 group-hover/btn:text-white group-hover/btn:scale-110'
                    }`} />
                    <span>
                      {isCurrentActiveCall 
                        ? (lang === 'hi' ? 'कॉल काटें ✕' : 'Cancel Call ✕') 
                        : (lang === 'hi' ? (t?.btnTele || 'टेली-परामर्श') : 'Tele-OPD')}
                    </span>
                  </button>
                </div>
              </div>

            </div>
          );
        })}

        {filteredPatients.length === 0 && (
          <div className="col-span-full py-16 px-6 flex flex-col items-center justify-center text-center bg-white rounded-3xl border border-dashed border-slate-300 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-3">
              <Search className="w-7 h-7 stroke-[2]" />
            </div>
            <h3 className="text-base font-black text-slate-800 tracking-tight">
              {lang === 'hi' ? 'कोई नागरिक रिकॉर्ड नहीं मिला' : 'No Citizens Found'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              {lang === 'hi' ? 'कृपया खोज शब्द बदलें या सक्रिय फ़िल्टर साफ़ करें।' : 'Try adjusting your search keywords or clear the active severity filter.'}
            </p>
          </div>
        )}
      </div>

      {/* REGISTER / EDIT CITIZEN MODAL (RESTORED WITH PREGNANCY & GESTATIONAL WEEKS) */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-950 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                {editingPatient ? <Edit2 className="w-5 h-5 text-teal-400" /> : <UserPlus className="w-5 h-5 text-teal-400" />}
                <h3 className="text-sm font-black tracking-tight">
                  {editingPatient 
                    ? (lang === 'hi' ? 'नागरिक विवरण संपादित करें' : 'Edit Citizen Profile') 
                    : (lang === 'hi' ? (t?.registerCitizenBtn || 'नया नागरिक पंजीकृत करें') : '+ Register New Citizen')}
                </h3>
              </div>
              <button 
                onClick={() => {
                  setIsRegisterOpen(false);
                  setEditingPatient(null);
                }}
                className="text-slate-400 hover:text-white text-xs font-bold px-2 py-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegisterOrEditSubmit} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {lang === 'hi' ? 'पूरा नाम (Full Name)' : 'Full Name'}
                  </label>
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {lang === 'hi' ? 'आयु (वर्ष)' : 'Age (Years)'}
                  </label>
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {lang === 'hi' ? 'लिंग (Gender)' : 'Gender'}
                  </label>
                  <select
                    value={formData.gender}
                    onChange={(e) => {
                      const newG = e.target.value;
                      setFormData({ 
                        ...formData, 
                        gender: newG,
                        isPregnant: newG === 'Female' ? formData.isPregnant : false,
                        gestationalWeeks: newG === 'Female' ? formData.gestationalWeeks : ''
                      });
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium bg-white"
                  >
                    <option value="Female">{lang === 'hi' ? 'महिला (Female)' : 'Female'}</option>
                    <option value="Male">{lang === 'hi' ? 'पुरुष (Male)' : 'Male'}</option>
                    <option value="Other">{lang === 'hi' ? 'अन्य (Other)' : 'Other'}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-teal-600" />
                    <span>{lang === 'hi' ? 'पंजीकरण दिनांक' : 'Registration Date'}</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.registrationDate}
                    onChange={(e) => setFormData({ ...formData, registrationDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium bg-white"
                  />
                </div>
              </div>

              {/* RESTORED MATERNAL / PREGNANCY & ANC BLOCK */}
              {formData.gender === 'Female' && (
                <div className="p-3.5 bg-pink-50/70 border border-pink-200 rounded-2xl space-y-2.5 transition-all">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formData.isPregnant}
                        onChange={(e) => setFormData({ ...formData, isPregnant: e.target.checked })}
                        className="w-4 h-4 text-pink-600 rounded border-pink-300 focus:ring-pink-500 accent-pink-600 cursor-pointer"
                      />
                      <span className="text-xs font-black text-pink-900 flex items-center gap-1.5">
                        <Baby className="w-4 h-4 text-pink-600" />
                        {lang === 'hi' ? 'गर्भवती महिला (Antenatal Care - ANC)' : 'Currently Pregnant / ANC Case'}
                      </span>
                    </label>

                    {formData.isPregnant && (
                      <span className="text-[10px] font-bold text-pink-700 bg-pink-100 px-2 py-0.5 rounded-full border border-pink-200">
                        {lang === 'hi' ? 'उच्च प्राथमिकता' : 'High Priority'}
                      </span>
                    )}
                  </div>

                  {formData.isPregnant && (
                    <div className="pt-2 border-t border-pink-200/60 grid grid-cols-2 gap-3 animate-fadeIn">
                      <div>
                        <label className="block text-[11px] font-bold text-pink-900 mb-1">
                          {lang === 'hi' ? 'गर्भधारण अवधि (सप्ताह)' : 'Gestational Age (Weeks)'}
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="42"
                          required={formData.isPregnant}
                          value={formData.gestationalWeeks}
                          onChange={(e) => setFormData({ ...formData, gestationalWeeks: e.target.value })}
                          className="w-full px-3 py-1.5 text-xs rounded-xl border border-pink-300 bg-white focus:outline-none focus:ring-2 focus:ring-pink-500 font-bold text-pink-950"
                          placeholder="e.g. 15"
                        />
                      </div>
                      <div className="flex items-center text-[10px] text-pink-800 font-medium leading-tight">
                        {lang === 'hi' 
                          ? 'डॉक्टर को प्रेगनेंसी इंडिकेटर और सेफ मेडिसिन वार्निंग दिखेगी।' 
                          : 'Flags contraindications (ACE/ARBs/NSAIDs) on Doctor Desk.'}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {lang === 'hi' ? 'गाँव / उप-केंद्र' : 'Village Hub'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.village}
                    onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
                    placeholder="e.g. Rampur Sub-Center"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {lang === 'hi' ? 'मोबाइल नंबर' : 'Mobile Contact'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
                    placeholder="e.g. 9876543210"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {lang === 'hi' ? 'आभा स्वास्थ्य संख्या (वैकल्पिक)' : 'ABHA Health ID (Optional)'}
                </label>
                <input
                  type="text"
                  value={formData.abhaId}
                  onChange={(e) => setFormData({ ...formData, abhaId: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
                  placeholder="91-0000-0000-0000"
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5 text-teal-600" />
                    {lang === 'hi' ? 'पंजीकरण वॉयस नोट' : 'Registration Voice Profile'}
                  </span>

                  {!regAudioBase64 && (
                    <button
                      type="button"
                      onClick={isAudioRecording ? stopRegistrationAudio : startRegistrationAudio}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                        isAudioRecording
                          ? 'bg-rose-600 text-white animate-pulse shadow-md shadow-rose-600/30'
                          : 'bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100'
                      }`}
                    >
                      {isAudioRecording ? <Square className="w-3 h-3 fill-current" /> : <Mic className="w-3 h-3" />}
                      <span>
                        {isAudioRecording 
                          ? `${lang === 'hi' ? 'रोकें' : 'Stop'} (${audioSeconds}s)` 
                          : (lang === 'hi' ? 'आवाज़ रिकॉर्ड करें' : 'Record Voice')}
                      </span>
                    </button>
                  )}
                </div>

                {regAudioBase64 && (
                  <div className="p-2.5 bg-white border border-teal-200 rounded-xl flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={togglePlayAudio}
                        className="w-7 h-7 rounded-lg bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center transition-all cursor-pointer"
                      >
                        {isPlayingAudio ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                      </button>
                      <div>
                        <p className="text-[11px] font-bold text-slate-800">
                          {lang === 'hi' ? 'वॉयस नोट संलग्न है' : 'Voice Note Attached'}
                        </p>
                        <p className="text-[9px] text-slate-500">
                          {lang === 'hi' ? 'डॉक्टर के पास सुरक्षित रूप से पहुंचेगा' : 'Permanently saved to record'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={deleteRegistrationAudio}
                      className="text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg text-xs cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <audio
                      ref={audioPlayerRef}
                      src={regAudioBase64}
                      onEnded={() => setIsPlayingAudio(false)}
                      className="hidden"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {lang === 'hi' ? 'लक्षण एवं क्लिनिकल अवलोकन' : 'Symptoms / Field Notes'}
                </label>
                <textarea
                  rows="2"
                  value={formData.fieldNotes}
                  onChange={(e) => setFormData({ ...formData, fieldNotes: e.target.value })}
                  placeholder={lang === 'hi' ? 'लक्षण या समस्या दर्ज करें...' : 'Record symptoms...'}
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
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  {lang === 'hi' ? 'रद्द करें' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-sm cursor-pointer"
                >
                  {editingPatient 
                    ? (lang === 'hi' ? 'बदलाव सुरक्षित करें' : 'Save Changes') 
                    : (lang === 'hi' ? 'नागरिक पंजीकृत करें' : 'Register Citizen')}
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
              {lang === 'hi' ? 'नागरिक रिकॉर्ड हटाएं' : 'Delete Citizen Record'}
            </h3>
            <p className="text-xs text-slate-500 mt-2">
              {lang === 'hi' ? (
                <>क्या आप सच में <strong className="text-slate-800">{patientToDelete.name}</strong> का रिकॉर्ड हटाना चाहते हैं?</>
              ) : (
                <>Are you sure you want to delete <strong className="text-slate-800">{patientToDelete.name}</strong>?</>
              )}
            </p>
            <div className="flex gap-2 mt-5 justify-end">
              <button
                type="button"
                onClick={() => setPatientToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl cursor-pointer"
              >
                {lang === 'hi' ? 'रद्द करें' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={confirmDeleteCitizen}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 rounded-xl cursor-pointer"
              >
                {lang === 'hi' ? 'रिकॉर्ड हटाएं' : 'Delete Record'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prescription Modal */}
      {selectedRxPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-950 p-5 text-white flex items-center justify-between no-print">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-tight">
                    {lang === 'hi' ? 'डॉक्टर द्वारा ई-पर्चा (Digital Prescription)' : 'Digital Clinical Prescription (Rx)'}
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    {lang === 'hi' ? 'अधिकृत टेली-परामर्श मेडिकल ऑर्डर' : 'Official e-Hospital Tele-Consultation Order'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedRxPatient(null)}
                className="text-slate-400 hover:text-white text-xs font-bold px-2 py-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {patientRxHistoryList.length > 1 && (
              <div className="p-3 bg-slate-100 border-b border-slate-200 flex items-center gap-2 overflow-x-auto no-print">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 shrink-0 flex items-center gap-1">
                  <History className="w-3.5 h-3.5 text-teal-600" />
                  {lang === 'hi' ? 'परामर्श विजिट्स:' : 'Visits:'} ({patientRxHistoryList.length})
                </span>
                {patientRxHistoryList.map((rx, idx) => {
                  const isSelected = selectedRxIndex === idx;
                  const dateLabel = formatSafeDate(rx.timestamp, lang).split(',')[0];
                  return (
                    <button
                      key={rx._id || rx.timestamp || idx}
                      type="button"
                      onClick={() => setSelectedRxIndex(idx)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                        isSelected 
                          ? 'bg-teal-600 text-white shadow-xs' 
                          : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-300'
                      }`}
                    >
                      <span>#{patientRxHistoryList.length - idx}</span>
                      <span className="text-[10px] opacity-80 font-normal">({dateLabel})</span>
                      {idx === 0 && (
                        <span className="text-[8px] bg-teal-800 text-teal-100 px-1 rounded uppercase font-bold">
                          {lang === 'hi' ? 'नवीनतम' : 'Latest'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {activeRx ? (
                <>
                  <div className="border-b-2 border-slate-800 pb-3 flex justify-between items-start">
                    <div>
                      <h2 className="text-base font-black text-slate-900 tracking-tight uppercase">
                        {lang === 'hi' ? 'स्वास्थ्य सेतु चिकित्सा पर्ची' : 'SwasthyaSetu Clinical Slip'}
                      </h2>
                      <p className="text-xs text-slate-700 font-bold mt-0.5">
                        {lang === 'hi' ? 'चिकित्सा अधिकारी:' : 'Medical Officer:'} <span className="text-slate-900">{activeRx.doctorName || 'Dr. Arvind Sharma (MO)'}</span>
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        MCI Reg: {activeRx.doctorRegNo || 'UP-MCI-84920'} • ABDM Verified
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="px-2.5 py-0.5 bg-emerald-100 border border-emerald-300 text-emerald-800 font-extrabold rounded-md text-[10px] uppercase block mb-1">
                        ABDM Signed
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono font-bold block">
                        {formatSafeDate(activeRx.timestamp, lang)}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">
                        {lang === 'hi' ? 'मरीज़ का नाम' : 'Citizen Name'}
                      </span>
                      <strong className="text-slate-900">{selectedRxPatient.name || activeRx.patientName}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">
                        {lang === 'hi' ? 'आयु / लिंग' : 'Age / Gender'}
                      </span>
                      <span className="font-semibold text-slate-800">
                        {selectedRxPatient.age || 26} {lang === 'hi' ? 'वर्ष' : 'y'} • {selectedRxPatient.gender === 'Female' ? (lang === 'hi' ? 'महिला' : 'Female') : (lang === 'hi' ? 'पुरुष' : 'Male')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">
                        {lang === 'hi' ? 'आभा संख्या' : 'ABHA Number'}
                      </span>
                      <span className="font-mono font-bold text-teal-800 text-[11px]">{selectedRxPatient.abhaId || 'Linked'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">
                        {lang === 'hi' ? 'गाँव / केंद्र' : 'Village Hub'}
                      </span>
                      <span className="font-semibold text-slate-800">{selectedRxPatient.village || 'Field Center'}</span>
                    </div>
                  </div>

                  {activeRx.vitalsAtConsult && (
                    <div className="p-2.5 bg-teal-50/70 border border-teal-200 rounded-xl">
                      <span className="text-[9px] font-black uppercase text-teal-900 block mb-1">
                        {lang === 'hi' ? 'परामर्श के समय वाइटल्स:' : 'Clinical Vitals at Consultation:'}
                      </span>
                      <div className="grid grid-cols-4 gap-2 text-center font-mono text-xs">
                        <div className="bg-white p-1 rounded border border-teal-100">
                          <span className="text-[8px] text-slate-400 block">BP</span>
                          <strong>{activeRx.vitalsAtConsult.bp || '120/80'}</strong>
                        </div>
                        <div className="bg-white p-1 rounded border border-teal-100">
                          <span className="text-[8px] text-slate-400 block">Pulse</span>
                          <strong>{activeRx.vitalsAtConsult.pulse || 72} bpm</strong>
                        </div>
                        <div className="bg-white p-1 rounded border border-teal-100">
                          <span className="text-[8px] text-slate-400 block">SpO2</span>
                          <strong>{activeRx.vitalsAtConsult.spo2 || 98}%</strong>
                        </div>
                        <div className="bg-white p-1 rounded border border-teal-100">
                          <span className="text-[8px] text-slate-400 block">Temp</span>
                          <strong>{activeRx.vitalsAtConsult.temp || 98.6}°F</strong>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      {lang === 'hi' ? 'क्लिनिकल डायग्नोसिस' : 'Clinical Diagnosis'}
                    </label>
                    <p className="text-sm font-black text-slate-900 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      {activeRx.diagnosis || (lang === 'hi' ? 'डायग्नोसिस दर्ज है।' : 'Clinical Diagnosis recorded on file.')}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Pill className="w-3.5 h-3.5 text-teal-600" />
                      <span>{lang === 'hi' ? 'दवाएं एवं खुराक (Prescribed Medicines & Dosage)' : 'Prescribed Medicines & Dosage (Rx)'}</span>
                    </label>
                    <div className="p-3 bg-white rounded-xl border border-slate-300 font-mono text-xs text-slate-950 font-bold leading-relaxed whitespace-pre-line shadow-2xs">
                      {activeRx.medicines || (lang === 'hi' ? 'दवाएं फाइल पर दर्ज हैं।' : 'Medicines detailed on file.')}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      {lang === 'hi' ? 'डॉक्टर के निर्देश एवं सलाह' : 'Doctor Directives & Advice'}
                    </label>
                    <p className="text-xs text-slate-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200 leading-relaxed font-semibold">
                      {activeRx.advice || (lang === 'hi' ? 'नियमित स्वास्थ्य सावधानियों का पालन करें।' : 'Follow routine medical precautions.')}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-500">
                    <span className="flex items-center gap-1 font-semibold text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {lang === 'hi' ? 'चिकित्सा अधिकारी द्वारा डिजिटल रूप से हस्ताक्षरित' : 'Authenticated by Medical Officer'}
                    </span>
                    <span className="font-mono">
                      {lang === 'hi' ? 'विजिट' : 'Encounter'} #{patientRxHistoryList.length > 0 ? (patientRxHistoryList.length - selectedRxIndex) : 1}
                    </span>
                  </div>
                </>
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs">
                  {lang === 'hi' ? 'इस नागरिक के लिए कोई पर्ची उपलब्ध नहीं है।' : 'No prescription record available for this citizen.'}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-200 bg-slate-50 no-print">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{lang === 'hi' ? 'पर्ची प्रिंट करें' : 'Print Selected Rx'}</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedRxPatient(null)}
                className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                {lang === 'hi' ? 'बंद करें' : 'Acknowledge & Close'}
              </button>
            </div>

          </div>
        </div>
      )}

      {selectedPatientForTriage && (
        <TriageAssessmentModal
          patient={selectedPatientForTriage}
          onClose={() => {
            setSelectedPatientForTriage(null);
            loadPatientsAndRx();
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
          onEndCall={() => setSelectedPatientForTele(null)}
        />
      )}

    </div>
  );
}