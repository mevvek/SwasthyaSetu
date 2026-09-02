import React, { useState, useEffect } from 'react';
import { useSocket } from '../../context/SocketContext';
import { db } from '../../db/offlineDb';
import { updatePatientApi } from '../../utils/api';
import { 
  HeartPulse, 
  X, 
  Sparkles, 
  Mic, 
  MicOff,
  CheckCircle2 
} from 'lucide-react';
import { useSpeechRecognition } from '../../utils/useSpeechRecognition';

export default function TriageAssessmentModal({ patient, onClose }) {
  const { socket } = useSocket();
  const { isListening, transcript, startListening, stopListening, hasSupport } = useSpeechRecognition();

  const [vitals, setVitals] = useState({
    systolic: patient?.lastVitals?.bp?.split('/')[0] || '120',
    diastolic: patient?.lastVitals?.bp?.split('/')[1] || '80',
    pulse: patient?.lastVitals?.pulse || '75',
    spO2: patient?.lastVitals?.spO2 || '98',
    temp: patient?.lastVitals?.temp || '98.6',
    respRate: patient?.lastVitals?.respRate || '18'
  });

  const [notes, setNotes] = useState(patient?.fieldNotes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dynamic Triage State
  const [triageResult, setTriageResult] = useState({
    severity: 'LOW_GREEN',
    score: 10,
    flags: ['All physiological vitals within safe clinical baseline.'],
    action: 'Routine observation and nutritional guidance.'
  });

  useEffect(() => {
    if (transcript) {
      setNotes((prev) => (prev ? `${prev} ${transcript}` : transcript));
    }
  }, [transcript]);

  // Real-time Dynamic AI Triage Recalculation
  useEffect(() => {
    const sys = Number(vitals.systolic) || 0;
    const dia = Number(vitals.diastolic) || 0;
    const pulse = Number(vitals.pulse) || 0;
    const spo2 = Number(vitals.spO2) || 0;
    const temp = Number(vitals.temp) || 0;
    const rr = Number(vitals.respRate) || 0;

    const redFlags = [];
    const yellowFlags = [];

    // Red Checks (Critical)
    if (sys >= 160 || dia >= 110) {
      redFlags.push(`Severe Hypertension / Pre-eclampsia Risk (BP: ${sys}/${dia} mmHg)`);
    }
    if (spo2 > 0 && spo2 < 90) {
      redFlags.push(`Critical Hypoxia / Respiratory Distress (SpO2: ${spo2}%)`);
    }
    if (pulse > 130 || (pulse > 0 && pulse < 45)) {
      redFlags.push(`Dangerous Hemodynamic Instability (Pulse: ${pulse} bpm)`);
    }
    if (temp >= 103) {
      redFlags.push(`Severe Hyperpyrexia / Sepsis Risk (Temp: ${temp}°F)`);
    }

    // Yellow Checks (Moderate)
    if (redFlags.length === 0) {
      if ((sys >= 140 && sys < 160) || (dia >= 90 && dia < 110)) {
        yellowFlags.push(`Moderate Hypertension Stage 2 (BP: ${sys}/${dia} mmHg)`);
      }
      if (spo2 >= 90 && spo2 <= 94) {
        yellowFlags.push(`Mild Hypoxemia (SpO2: ${spo2}%)`);
      }
      if ((pulse > 100 && pulse <= 130) || (pulse >= 45 && pulse < 55)) {
        yellowFlags.push(`Tachycardia / Elevated Heart Rate (Pulse: ${pulse} bpm)`);
      }
      if (temp >= 100.4 && temp < 103) {
        yellowFlags.push(`Moderate Febrile Illness (Temp: ${temp}°F)`);
      }
      if (rr > 24 || (rr > 0 && rr < 10)) {
        yellowFlags.push(`Abnormal Respiratory Rate (${rr}/min)`);
      }
    }

    // Verdict Assignment
    if (redFlags.length > 0) {
      setTriageResult({
        severity: 'CRITICAL_RED',
        score: 85,
        flags: redFlags,
        action: 'Immediate referral to Medical Officer / FRU. Administer emergency protocol.'
      });
    } else if (yellowFlags.length > 0) {
      setTriageResult({
        severity: 'MODERATE_YELLOW',
        score: 45,
        flags: yellowFlags,
        action: 'Schedule Tele-OPD consultation with Medical Officer within 4 hours.'
      });
    } else {
      setTriageResult({
        severity: 'LOW_GREEN',
        score: 10,
        flags: ['All physiological vitals within safe clinical baseline.'],
        action: 'Stable condition. Routine maternal/general healthcare guidance.'
      });
    }
  }, [vitals]);

  const handleVitalChange = (field, value) => {
    setVitals((prev) => ({ ...prev, [field]: value }));
  };

  // Save, Update IndexedDB, Update MongoDB, and Broadcast to Doctor
  const handleSaveAssessment = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const pid = patient._id || patient.id;
    const updatedPatientPayload = {
      ...patient,
      _id: pid,
      id: pid,
      name: patient.name || patient.patientName,
      severity: triageResult.severity,
      category: triageResult.severity === 'CRITICAL_RED' ? 'EMERGENCY' : 'GENERAL',
      lastVitals: {
        bp: `${vitals.systolic}/${vitals.diastolic}`,
        pulse: Number(vitals.pulse),
        spO2: Number(vitals.spO2),
        temp: Number(vitals.temp),
        respRate: Number(vitals.respRate)
      },
      lastTriage: {
        severity: triageResult.severity === 'CRITICAL_RED' ? 'RED' : triageResult.severity === 'MODERATE_YELLOW' ? 'YELLOW' : 'GREEN',
        score: triageResult.score,
        flags: triageResult.flags,
        timestamp: new Date().toISOString()
      },
      fieldNotes: notes,
      synced: true
    };

    try {
      // 1. Update IndexedDB local database
      await db.patients.put(updatedPatientPayload);

      // 2. Update MongoDB Atlas via REST API
      try {
        await updatePatientApi(pid, {
          severity: updatedPatientPayload.severity,
          lastVitals: updatedPatientPayload.lastVitals,
          fieldNotes: updatedPatientPayload.fieldNotes
        });
      } catch (apiErr) {
        console.warn('API update fallback to socket broadcast:', apiErr);
      }

      // 3. Emit real-time WebSocket event directly to Doctor's live queue
      if (socket) {
        socket.emit('patient_queue_updated', updatedPatientPayload);
      }

      setIsSubmitting(false);
      onClose();
    } catch (err) {
      console.error('Failed to complete assessment:', err);
      setIsSubmitting(false);
      onClose();
    }
  };

  const isRed = triageResult.severity === 'CRITICAL_RED';
  const isYellow = triageResult.severity === 'MODERATE_YELLOW';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm font-sans">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-5 bg-white border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600">
              <HeartPulse className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tight">
                Clinical AI Triage & Vitals Assessment
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Patient: <span className="font-bold text-slate-800">{patient?.name || patient?.patientName}</span> ({patient?.age}y • {patient?.gender})
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSaveAssessment} className="p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* AI Clinical Urgency Classification Banner */}
          <div className={`p-4 rounded-2xl border transition-all ${
            isRed 
              ? 'bg-rose-50 border-rose-200 text-rose-950' 
              : isYellow 
              ? 'bg-amber-50 border-amber-200 text-amber-950' 
              : 'bg-emerald-50 border-emerald-200 text-emerald-950'
          }`}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider">
                <Sparkles className="w-4 h-4" />
                AI CLINICAL URGENCY CLASSIFICATION:
              </div>
              <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider ${
                isRed 
                  ? 'bg-rose-600 text-white' 
                  : isYellow 
                  ? 'bg-amber-600 text-white' 
                  : 'bg-emerald-600 text-white'
              }`}>
                {isRed ? 'CRITICAL RED' : isYellow ? 'MODERATE YELLOW' : 'NORMAL GREEN'}
              </span>
            </div>

            <div className="text-xs space-y-1">
              <p className="font-bold">Detected Physiological Flags:</p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] font-semibold">
                {triageResult.flags.map((flag, idx) => (
                  <li key={idx}>{flag}</li>
                ))}
              </ul>
              <p className="pt-1.5 text-[11px] font-bold">
                <span className="opacity-80">Recommended Action: </span>
                {triageResult.action}
              </p>
            </div>
          </div>

          {/* Vitals Input Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Systolic BP (mmHg)</label>
              <input
                type="number"
                required
                value={vitals.systolic}
                onChange={(e) => handleVitalChange('systolic', e.target.value)}
                className="w-full px-3 py-1.5 text-sm font-black rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-teal-600 focus:outline-none"
              />
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Diastolic BP (mmHg)</label>
              <input
                type="number"
                required
                value={vitals.diastolic}
                onChange={(e) => handleVitalChange('diastolic', e.target.value)}
                className="w-full px-3 py-1.5 text-sm font-black rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-teal-600 focus:outline-none"
              />
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Pulse (bpm)</label>
              <input
                type="number"
                required
                value={vitals.pulse}
                onChange={(e) => handleVitalChange('pulse', e.target.value)}
                className="w-full px-3 py-1.5 text-sm font-black rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-teal-600 focus:outline-none"
              />
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
              <label className="block text-[11px] font-bold text-slate-500 mb-1">SpO2 Oxygen (%)</label>
              <input
                type="number"
                required
                value={vitals.spO2}
                onChange={(e) => handleVitalChange('spO2', e.target.value)}
                className="w-full px-3 py-1.5 text-sm font-black rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-teal-600 focus:outline-none"
              />
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Temp (°F)</label>
              <input
                type="number"
                step="0.1"
                required
                value={vitals.temp}
                onChange={(e) => handleVitalChange('temp', e.target.value)}
                className="w-full px-3 py-1.5 text-sm font-black rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-teal-600 focus:outline-none"
              />
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Resp Rate (/min)</label>
              <input
                type="number"
                required
                value={vitals.respRate}
                onChange={(e) => handleVitalChange('respRate', e.target.value)}
                className="w-full px-3 py-1.5 text-sm font-black rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-teal-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Field Notes & Hindi Voice Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Field Clinical Notes & Symptoms
              </label>
              {hasSupport && (
                <button
                  type="button"
                  onClick={isListening ? stopListening : startListening}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold border transition-all ${
                    isListening 
                      ? 'bg-rose-500 text-white border-rose-600 animate-pulse' 
                      : 'bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100'
                  }`}
                >
                  {isListening ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                  <span>{isListening ? 'Listening...' : 'Voice Input (Mic)'}</span>
                </button>
              )}
            </div>
            <textarea
              rows="3"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Mareez ko 2 din se tez bukhar aur sar dard hai..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
            />
          </div>

          {/* Action Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving Assessment...' : 'Save & Sync Assessment'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}