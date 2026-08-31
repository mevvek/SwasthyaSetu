import React, { useState, useEffect } from 'react';
import { evaluateClinicalTriage } from '../../utils/triageEngine';
import { useSpeechRecognition } from '../../utils/useSpeechRecognition';
import { 
  HeartPulse, 
  Mic, 
  MicOff, 
  AlertTriangle, 
  CheckCircle, 
  Activity, 
  ShieldAlert, 
  Send, 
  X,
  Languages
} from 'lucide-react';

export default function TriageAssessmentModal({ patient, onClose, onSaveAssessment }) {
  const [vitals, setVitals] = useState({
    systolicBP: 120,
    diastolicBP: 80,
    pulseRate: 78,
    spO2: 98,
    temperature: 98.6,
    respiratoryRate: 18,
    symptomsText: ''
  });

  const [voiceLang, setVoiceLang] = useState('hi-IN'); // 'hi-IN' | 'en-IN'
  const [triageResult, setTriageResult] = useState(null);

  // Speech Recognition Hook
  const { isListening, toggleListening, error: micError } = useSpeechRecognition((transcript) => {
    setVitals((prev) => ({
      ...prev,
      symptomsText: prev.symptomsText ? `${prev.symptomsText} ${transcript}` : transcript
    }));
  });

  // Re-run Clinical AI Engine whenever vitals or symptoms change
  useEffect(() => {
    const result = evaluateClinicalTriage(vitals, patient);
    setTriageResult(result);
  }, [vitals, patient]);

  const handleChange = (field, value) => {
    setVitals((prev) => ({ ...prev, [field]: value }));
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    onSaveAssessment({
      patientId: patient.id,
      patientName: patient.name,
      vitals,
      triageResult,
      assessedAt: new Date().toISOString()
    });
    onClose();
  };

  const getSeverityBanner = () => {
    if (!triageResult) return null;
    switch (triageResult.severity) {
      case 'CRITICAL_RED':
        return (
          <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl flex items-start gap-3 animate-pulse">
            <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-rose-900 text-xs tracking-wide uppercase px-2 py-0.5 rounded bg-rose-200">
                  CRITICAL RED — EMERGENCY ACTION REQUIRED
                </span>
              </div>
              <ul className="mt-2 text-xs text-rose-800 space-y-1 font-semibold list-disc list-inside">
                {triageResult.redFlags.map((flag, idx) => (
                  <li key={idx}>{flag}</li>
                ))}
              </ul>
            </div>
          </div>
        );
      case 'MODERATE_YELLOW':
        return (
          <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-900 text-xs tracking-wide uppercase px-2 py-0.5 rounded bg-amber-200">
                MODERATE YELLOW — DOCTOR TELE-CONSULT RECOMMENDED
              </span>
              <ul className="mt-1.5 text-xs text-amber-800 space-y-1 font-medium list-disc list-inside">
                {triageResult.yellowFlags.map((flag, idx) => (
                  <li key={idx}>{flag}</li>
                ))}
              </ul>
            </div>
          </div>
        );
      case 'LOW_GREEN':
      default:
        return (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-xs font-bold text-emerald-900">
              LOW GREEN — Normal Hemodynamic & Vital Parameters
            </span>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[95vh] flex flex-col">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/80">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-black text-slate-900">{patient.name}</span>
              <span className="text-xs text-slate-500 font-medium">({patient.age}y, {patient.gender})</span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-800">
                {patient.category}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">ABHA: {patient.abhaId} • {patient.village}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleFormSubmit} className="p-5 space-y-5 overflow-y-auto flex-1">
          
          {/* Dynamic AI Triage Banner */}
          {getSeverityBanner()}

          {/* Vitals Numeric Inputs */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-teal-600" />
              Real-time Field Physiological Vitals
            </h4>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {/* BP Systolic */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Systolic BP</label>
                <div className="flex items-center gap-1 mt-1">
                  <input
                    type="number"
                    required
                    value={vitals.systolicBP}
                    onChange={(e) => handleChange('systolicBP', e.target.value)}
                    className="w-full bg-white px-2 py-1 text-sm font-bold text-slate-900 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-600 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 font-semibold">mmHg</span>
                </div>
              </div>

              {/* BP Diastolic */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Diastolic BP</label>
                <div className="flex items-center gap-1 mt-1">
                  <input
                    type="number"
                    required
                    value={vitals.diastolicBP}
                    onChange={(e) => handleChange('diastolicBP', e.target.value)}
                    className="w-full bg-white px-2 py-1 text-sm font-bold text-slate-900 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-600 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 font-semibold">mmHg</span>
                </div>
              </div>

              {/* Pulse Rate */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Pulse / Heart Rate</label>
                <div className="flex items-center gap-1 mt-1">
                  <input
                    type="number"
                    required
                    value={vitals.pulseRate}
                    onChange={(e) => handleChange('pulseRate', e.target.value)}
                    className="w-full bg-white px-2 py-1 text-sm font-bold text-slate-900 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-600 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 font-semibold">bpm</span>
                </div>
              </div>

              {/* SpO2 */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Oxygen (SpO2)</label>
                <div className="flex items-center gap-1 mt-1">
                  <input
                    type="number"
                    required
                    value={vitals.spO2}
                    onChange={(e) => handleChange('spO2', e.target.value)}
                    className="w-full bg-white px-2 py-1 text-sm font-bold text-slate-900 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-600 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 font-semibold">%</span>
                </div>
              </div>

              {/* Temperature */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Temperature</label>
                <div className="flex items-center gap-1 mt-1">
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={vitals.temperature}
                    onChange={(e) => handleChange('temperature', e.target.value)}
                    className="w-full bg-white px-2 py-1 text-sm font-bold text-slate-900 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-600 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 font-semibold">°F</span>
                </div>
              </div>

              {/* Respiratory Rate */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Respiratory Rate</label>
                <div className="flex items-center gap-1 mt-1">
                  <input
                    type="number"
                    required
                    value={vitals.respiratoryRate}
                    onChange={(e) => handleChange('respiratoryRate', e.target.value)}
                    className="w-full bg-white px-2 py-1 text-sm font-bold text-slate-900 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-600 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 font-semibold">/min</span>
                </div>
              </div>
            </div>
          </div>

          {/* Voice Input & Symptoms Field */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                Reported Clinical Symptoms
              </label>

              {/* Mic Controls */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setVoiceLang(voiceLang === 'hi-IN' ? 'en-IN' : 'hi-IN')}
                  className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-200 flex items-center gap-1"
                >
                  <Languages className="w-3 h-3" />
                  {voiceLang === 'hi-IN' ? 'Hindi (हिंदी)' : 'English'}
                </button>

                <button
                  type="button"
                  onClick={() => toggleListening(voiceLang)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                    isListening
                      ? 'bg-rose-600 text-white animate-pulse shadow-md shadow-rose-600/30'
                      : 'bg-teal-600 hover:bg-teal-700 text-white shadow-sm'
                  }`}
                >
                  {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  {isListening ? 'Listening...' : 'Voice Mic'}
                </button>
              </div>
            </div>

            <textarea
              rows={3}
              value={vitals.symptomsText}
              onChange={(e) => handleChange('symptomsText', e.target.value)}
              placeholder="Speak or type symptoms (e.g. तेज सिरदर्द, चक्कर आना, blurred vision, high fever)..."
              className="w-full px-3 py-2 text-xs rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
            />
            {micError && <p className="text-[11px] text-rose-600 mt-1">{micError}</p>}
          </div>

          {/* Clinical Directives */}
          {triageResult && triageResult.recommendations.length > 0 && (
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Clinical Recommendations & Action Protocol:
              </span>
              <ul className="mt-1 text-xs text-slate-800 space-y-1 list-disc list-inside font-medium">
                {triageResult.recommendations.map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`flex-1 py-2.5 text-xs font-bold text-white rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                triageResult?.severity === 'CRITICAL_RED'
                  ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/25'
                  : 'bg-teal-600 hover:bg-teal-700 shadow-teal-600/25'
              }`}
            >
              <Send className="w-4 h-4" />
              {triageResult?.severity === 'CRITICAL_RED' ? 'Trigger Emergency PHC Alert' : 'Save & Sync Triage Record'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}