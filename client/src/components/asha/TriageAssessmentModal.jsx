import React, { useState, useEffect } from 'react';
import { 
  Heart, 
  Activity, 
  Thermometer, 
  Wind, 
  Mic, 
  MicOff, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  Sparkles,
  Stethoscope
} from 'lucide-react';

export default function TriageAssessmentModal({ patient, onClose, onSaveAssessment }) {
  const [vitals, setVitals] = useState({
    systolicBP: patient?.lastVitals?.bp ? Number(patient.lastVitals.bp.split('/')[0]) || 120 : 120,
    diastolicBP: patient?.lastVitals?.bp ? Number(patient.lastVitals.bp.split('/')[1]) || 80 : 80,
    pulseRate: patient?.lastVitals?.pulse || 76,
    spO2: patient?.lastVitals?.spO2 || 98,
    temperature: 98.6,
    respiratoryRate: 18
  });

  const [symptomsText, setSymptomsText] = useState('');
  const [isListening, setIsListening] = useState(false);

  // Clinical AI Triage Evaluation
  const evaluateTriage = () => {
    const redFlags = [];
    const recommendations = [];
    let severity = 'LOW_GREEN';

    const sBP = Number(vitals.systolicBP);
    const dBP = Number(vitals.diastolicBP);
    const pulse = Number(vitals.pulseRate);
    const spO2 = Number(vitals.spO2);
    const temp = Number(vitals.temperature);
    const text = symptomsText.toLowerCase();

    // Maternal / Hypertensive Urgency Trigger
    if (sBP >= 160 || dBP >= 110) {
      severity = 'CRITICAL_RED';
      redFlags.push('Severe Hypertension / Pre-eclampsia Risk (BP >= 160/110)');
      recommendations.push('Immediate referral to Medical Officer / FRU. Administer Magnesium Sulphate if indicated.');
    } else if (sBP >= 140 || dBP >= 90) {
      if (severity !== 'CRITICAL_RED') severity = 'MODERATE_YELLOW';
      redFlags.push('Stage 2 Hypertension (BP >= 140/90)');
      recommendations.push('Schedule Tele-consultation with MO within 24 hours.');
    }

    // Hypoxia / Pediatric Respiratory Distress
    if (spO2 < 92) {
      severity = 'CRITICAL_RED';
      redFlags.push('Severe Hypoxia (SpO2 < 92%)');
      recommendations.push('Start emergency Oxygen therapy & urgent ambulance transfer.');
    } else if (spO2 < 95) {
      if (severity !== 'CRITICAL_RED') severity = 'MODERATE_YELLOW';
      redFlags.push('Mild Hypoxia (SpO2 92-94%)');
      recommendations.push('Monitor respiratory vitals every 30 minutes.');
    }

    // Shock / Tachycardia
    if (pulse > 120) {
      severity = 'CRITICAL_RED';
      redFlags.push('Severe Tachycardia (Pulse > 120 bpm)');
      recommendations.push('Evaluate for hemorrhagic/septic shock.');
    }

    // Hyperpyrexia
    if (temp >= 103) {
      if (severity !== 'CRITICAL_RED') severity = 'MODERATE_YELLOW';
      redFlags.push('High Grade Pyrexia (Temp >= 103°F)');
      recommendations.push('Administer Paracetamol & cold sponging.');
    }

    // NLP Symptom keyword search
    if (text.includes('bleeding') || text.includes('khun') || text.includes('chakkar') || text.includes('convulsion') || text.includes('behosh')) {
      severity = 'CRITICAL_RED';
      redFlags.push('High-Risk Symptom Keywords Detected in Clinical Notes');
    }

    if (redFlags.length === 0) {
      recommendations.push('Continue routine antenatal/primary health follow-up.');
    }

    return { severity, redFlags, recommendations };
  };

  const triageResult = evaluateTriage();

  // Web Speech API Voice Dictation (Hindi/English)
  const toggleSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech Recognition is not supported by your browser.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'hi-IN';
    recognition.continuous = false;
    recognition.interimResults = false;

    if (!isListening) {
      recognition.start();
      setIsListening(true);

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setSymptomsText(prev => prev ? `${prev} ${transcript}` : transcript);
        setIsListening(false);
      };

      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
    } else {
      setIsListening(false);
    }
  };

  const handleSaveAssessment = () => {
    const assessmentRecord = {
      patientId: patient._id || patient.id,
      vitals: {
        ...vitals,
        symptomsText
      },
      triageResult
    };

    onSaveAssessment(assessmentRecord);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">Clinical AI Triage & Vitals Assessment</h3>
              <p className="text-xs text-slate-500">Patient: <span className="font-bold text-slate-700">{patient?.name}</span> ({patient?.age}y • {patient?.gender})</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Triage Urgency Result Alert */}
        <div className={`my-4 p-4 rounded-2xl border transition-all ${
          triageResult.severity === 'CRITICAL_RED' 
            ? 'bg-rose-50 border-rose-200 text-rose-900' 
            : triageResult.severity === 'MODERATE_YELLOW' 
              ? 'bg-amber-50 border-amber-200 text-amber-900' 
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider">AI Clinical Urgency Classification:</span>
            </div>
            <span className={`px-2.5 py-1 text-[11px] font-black rounded-lg ${
              triageResult.severity === 'CRITICAL_RED'
                ? 'bg-rose-600 text-white'
                : triageResult.severity === 'MODERATE_YELLOW'
                  ? 'bg-amber-600 text-white'
                  : 'bg-emerald-600 text-white'
            }`}>
              {triageResult.severity.replace('_', ' ')}
            </span>
          </div>

          {triageResult.redFlags.length > 0 && (
            <div className="mt-2 text-xs space-y-1">
              <p className="font-bold">Detected Physiological Flags:</p>
              <ul className="list-disc list-inside space-y-0.5">
                {triageResult.redFlags.map((flag, idx) => (
                  <li key={idx} className="font-semibold">{flag}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-2 text-xs">
            <span className="font-bold">Recommended Action: </span>
            <span className="font-semibold">{triageResult.recommendations.join(' ')}</span>
          </div>
        </div>

        {/* Vitals Form Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1 mb-1">
              <Heart className="w-3 h-3 text-rose-500" /> Systolic BP (mmHg)
            </label>
            <input
              type="number"
              value={vitals.systolicBP}
              onChange={(e) => setVitals({ ...vitals, systolicBP: e.target.value })}
              className="w-full bg-white px-3 py-1.5 rounded-xl border border-slate-300 font-bold text-slate-800 text-sm focus:ring-2 focus:ring-teal-600 outline-none"
            />
          </div>

          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1 mb-1">
              <Heart className="w-3 h-3 text-rose-500" /> Diastolic BP (mmHg)
            </label>
            <input
              type="number"
              value={vitals.diastolicBP}
              onChange={(e) => setVitals({ ...vitals, diastolicBP: e.target.value })}
              className="w-full bg-white px-3 py-1.5 rounded-xl border border-slate-300 font-bold text-slate-800 text-sm focus:ring-2 focus:ring-teal-600 outline-none"
            />
          </div>

          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1 mb-1">
              <Activity className="w-3 h-3 text-teal-600" /> Pulse (bpm)
            </label>
            <input
              type="number"
              value={vitals.pulseRate}
              onChange={(e) => setVitals({ ...vitals, pulseRate: e.target.value })}
              className="w-full bg-white px-3 py-1.5 rounded-xl border border-slate-300 font-bold text-slate-800 text-sm focus:ring-2 focus:ring-teal-600 outline-none"
            />
          </div>

          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1 mb-1">
              <Wind className="w-3 h-3 text-cyan-600" /> SpO2 Oxygen (%)
            </label>
            <input
              type="number"
              value={vitals.spO2}
              onChange={(e) => setVitals({ ...vitals, spO2: e.target.value })}
              className="w-full bg-white px-3 py-1.5 rounded-xl border border-slate-300 font-bold text-slate-800 text-sm focus:ring-2 focus:ring-teal-600 outline-none"
            />
          </div>

          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1 mb-1">
              <Thermometer className="w-3 h-3 text-amber-500" /> Temp (°F)
            </label>
            <input
              type="number"
              step="0.1"
              value={vitals.temperature}
              onChange={(e) => setVitals({ ...vitals, temperature: e.target.value })}
              className="w-full bg-white px-3 py-1.5 rounded-xl border border-slate-300 font-bold text-slate-800 text-sm focus:ring-2 focus:ring-teal-600 outline-none"
            />
          </div>

          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1 mb-1">
              <Activity className="w-3 h-3 text-indigo-500" /> Resp Rate (/min)
            </label>
            <input
              type="number"
              value={vitals.respiratoryRate}
              onChange={(e) => setVitals({ ...vitals, respiratoryRate: e.target.value })}
              className="w-full bg-white px-3 py-1.5 rounded-xl border border-slate-300 font-bold text-slate-800 text-sm focus:ring-2 focus:ring-teal-600 outline-none"
            />
          </div>

        </div>

        {/* Symptoms Voice Dictation Section */}
        <div className="mt-4">
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-bold text-slate-700 uppercase">Field Clinical Notes & Symptoms</label>
            <button
              type="button"
              onClick={toggleSpeechRecognition}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                isListening ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {isListening ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3 text-teal-600" />}
              {isListening ? 'Listening (Hindi)...' : 'Voice Input (Mic)'}
            </button>
          </div>

          <textarea
            rows={3}
            value={symptomsText}
            onChange={(e) => setSymptomsText(e.target.value)}
            placeholder="e.g. Mareez ko 2 din se tez bukhar aur sar dard hai..."
            className="w-full px-3 py-2 text-xs rounded-2xl border border-slate-300 focus:ring-2 focus:ring-teal-600 outline-none"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveAssessment}
            className="flex-1 py-2.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-md shadow-teal-600/20 transition-all flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            Save & Sync Assessment
          </button>
        </div>

      </div>
    </div>
  );
}