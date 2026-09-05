import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  Mic, 
  Square, 
  Play, 
  Pause, 
  Trash2, 
  X, 
  Plus, 
  Check 
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { db } from '../../db/offlineDb';

export default function TriageAssessmentModal({ patient, onClose, onSaved }) {
  const { lang } = useLanguage();

  // Core Vitals States
  const [systolic, setSystolic] = useState(patient?.lastTriage?.bpSystolic || '120');
  const [diastolic, setDiastolic] = useState(patient?.lastTriage?.bpDiastolic || '80');
  const [pulse, setPulse] = useState(patient?.lastTriage?.pulse || '72');
  const [spo2, setSpo2] = useState(patient?.lastTriage?.spo2 || '98');
  const [temp, setTemp] = useState(patient?.lastTriage?.temp || '98.6');
  const [respRate, setRespRate] = useState(patient?.lastTriage?.respRate || '18');
  
  // Clinical Text Notes: Strictly patient-specific or blank
  const [clinicalNotes, setClinicalNotes] = useState(
    patient?.lastTriage?.notes || patient?.fieldNotes || ''
  );

  // Triage-Specific Audio Note State (Distinct from registrationAudioNote)
  const [triageAudio, setTriageAudio] = useState(
    patient?.lastTriage?.triageAudioNote || patient?.triageAudioNote || null
  );
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Media recording and playback refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const audioPlayerRef = useRef(null);

  // Custom Extra Parameters State
  const [customVitals, setCustomVitals] = useState(
    patient?.lastTriage?.customVitals || patient?.customVitals || []
  );
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customValue, setCustomValue] = useState('');

  // Re-sync states whenever active patient changes
  useEffect(() => {
    if (patient) {
      setSystolic(patient.lastTriage?.bpSystolic || '120');
      setDiastolic(patient.lastTriage?.bpDiastolic || '80');
      setPulse(patient.lastTriage?.pulse || '72');
      setSpo2(patient.lastTriage?.spo2 || '98');
      setTemp(patient.lastTriage?.temp || '98.6');
      setRespRate(patient.lastTriage?.respRate || '18');
      setClinicalNotes(patient.lastTriage?.notes || patient.fieldNotes || '');
      setTriageAudio(patient.lastTriage?.triageAudioNote || patient.triageAudioNote || null);
      setCustomVitals(patient.lastTriage?.customVitals || patient.customVitals || []);
      setIsAddingCustom(false);
      setCustomTitle('');
      setCustomValue('');
    }
  }, [patient?._id, patient?.id]);

  // Clean up media resources on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
    };
  }, []);

  // --- Real Audio Recording Functions ---
  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          setTriageAudio(reader.result);
        };
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('Microphone permission is required to record triage voice notes.');
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  const deleteAudioRecording = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }
    setIsPlayingAudio(false);
    setTriageAudio(null);
    setRecordingSeconds(0);
  };

  const togglePlayAudio = () => {
    if (!audioPlayerRef.current) return;
    if (isPlayingAudio) {
      audioPlayerRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioPlayerRef.current.play();
      setIsPlayingAudio(true);
    }
  };

  // Evaluate Custom Vitals
  const evaluateCustomVital = (title, valStr) => {
    const val = parseFloat(valStr);
    const tLower = (title || '').toLowerCase().trim();

    if (isNaN(val)) return { severity: 'NORMAL', text: 'NORMAL' };

    if (tLower.includes('temp') || tLower.includes('fever') || tLower.includes('bukhar')) {
      if (val >= 102) return { severity: 'RED', text: 'HIGH FEVER', flag: `Critical Fever (${val} °F)` };
      if (val >= 100.4) return { severity: 'YELLOW', text: 'MODERATE FEVER', flag: `Moderate Fever (${val} °F)` };
      if (val < 95) return { severity: 'RED', text: 'HYPOTHERMIA', flag: `Hypothermia (${val} °F)` };
      return { severity: 'GREEN', text: 'NORMAL' };
    }

    if (tLower.includes('sugar') || tLower.includes('glucose') || tLower.includes('rbs') || tLower.includes('fbs')) {
      if (val >= 200 || val < 60) return { severity: 'RED', text: 'CRITICAL SUGAR', flag: `Critical Blood Sugar (${val} mg/dL)` };
      if (val >= 140 || val < 70) return { severity: 'YELLOW', text: 'ABNORMAL SUGAR', flag: `Elevated Sugar (${val} mg/dL)` };
      return { severity: 'GREEN', text: 'NORMAL' };
    }

    if (tLower.includes('hb') || tLower.includes('hemo') || tLower.includes('anemia')) {
      if (val < 7) return { severity: 'RED', text: 'SEVERE ANEMIA', flag: `Severe Low Hemoglobin (${val} g/dL)` };
      if (val < 10) return { severity: 'YELLOW', text: 'MILD ANEMIA', flag: `Mild Low Hemoglobin (${val} g/dL)` };
      return { severity: 'GREEN', text: 'NORMAL' };
    }

    if (val >= 200 || val <= 30) {
      return { severity: 'YELLOW', text: 'ABNORMAL', flag: `Abnormal ${title} (${val})` };
    }

    return { severity: 'GREEN', text: 'NORMAL' };
  };

  const handleAddCustomVital = (e) => {
    e.preventDefault();
    if (!customTitle.trim() || !customValue.trim()) return;

    setCustomVitals(prev => [
      ...prev, 
      { id: Date.now(), title: customTitle.trim(), value: customValue.trim() }
    ]);
    setCustomTitle('');
    setCustomValue('');
    setIsAddingCustom(false);
  };

  const handleRemoveCustomVital = (idToRemove) => {
    setCustomVitals(prev => prev.filter(item => item.id !== idToRemove));
  };

  // Rule-based AI Urgency Classifier
  const calculateUrgency = () => {
    const sys = Number(systolic);
    const dia = Number(diastolic);
    const sp = Number(spo2);
    const pr = Number(pulse);
    const tm = Number(temp);

    const flags = [];
    let hasCustomRed = false;
    let hasCustomYellow = false;

    if (sys >= 160 || sys < 85) flags.push(`Critical Blood Pressure (${sys}/${dia} mmHg)`);
    else if (sys >= 140 || sys < 90) flags.push(`Abnormal Blood Pressure (${sys}/${dia} mmHg)`);

    if (sp < 92) flags.push(`Critical Oxygen Saturation (${sp}%)`);
    else if (sp < 94) flags.push(`Low Oxygen Saturation (${sp}%)`);

    if (pr > 115 || pr < 50) flags.push(`Critical Pulse Rate (${pr} bpm)`);
    else if (pr > 100 || pr < 55) flags.push(`Abnormal Heart Rate (${pr} bpm)`);

    if (tm >= 102) flags.push(`High Fever (${tm} °F)`);
    else if (tm >= 100.4) flags.push(`Moderate Fever (${tm} °F)`);

    customVitals.forEach((cv) => {
      const evalRes = evaluateCustomVital(cv.title, cv.value);
      if (evalRes.severity === 'RED') {
        hasCustomRed = true;
        if (evalRes.flag) flags.push(evalRes.flag);
      } else if (evalRes.severity === 'YELLOW') {
        hasCustomYellow = true;
        if (evalRes.flag) flags.push(evalRes.flag);
      }
    });

    if (sp < 92 || sys >= 160 || tm >= 102 || hasCustomRed) {
      return {
        level: 'CRITICAL RED',
        badgeClass: 'bg-rose-600 text-white',
        borderClass: 'border-rose-300 bg-rose-50/50',
        flags: flags.length ? flags : ['Critical Clinical Signs Detected'],
        action: lang === 'hi' ? 'तुरंत डॉक्टर/सीएचसी रेफरल आवश्यक' : 'Immediate Medical Officer Tele-OPD consult & triage required.'
      };
    }
    if (flags.length > 0 || hasCustomYellow) {
      return {
        level: 'MODERATE YELLOW',
        badgeClass: 'bg-amber-500 text-white',
        borderClass: 'border-amber-300 bg-amber-50/50',
        flags,
        action: lang === 'hi' ? 'चिकित्सक परामर्श 4 घंटे के भीतर निर्धारित करें।' : 'Schedule Tele-OPD consultation with Medical Officer within 4 hours.'
      };
    }
    return {
      level: 'NORMAL GREEN',
      badgeClass: 'bg-emerald-600 text-white',
      borderClass: 'border-emerald-300 bg-emerald-50/50',
      flags: ['All standard and custom vitals are within normal clinical thresholds.'],
      action: lang === 'hi' ? 'नियमित घरेलू देखभाल एवं दवा जारी रखें।' : 'Routine follow-up and field monitoring advised.'
    };
  };

  const triageResult = calculateUrgency();

  const handleSaveTriage = async () => {
    const isRed = triageResult.level.includes('RED');
    const isYellow = triageResult.level.includes('YELLOW');

    const sugarVital = customVitals.find(cv => 
      cv.title && /(sugar|glucose|rbs|fbs)/i.test(cv.title)
    );
    const parsedSugar = sugarVital ? parseFloat(sugarVital.value) : undefined;

    const targetId = patient?._id || patient?.id;

    const triageRecord = {
      severity: isRed ? 'RED' : isYellow ? 'YELLOW' : 'GREEN',
      bpSystolic: Number(systolic),
      bpDiastolic: Number(diastolic),
      pulse: Number(pulse),
      spo2: Number(spo2),
      temp: Number(temp),
      respRate: Number(respRate),
      sugar: parsedSugar,
      bloodSugar: parsedSugar,
      notes: clinicalNotes,
      triageAudioNote: triageAudio,
      customVitals,
      timestamp: new Date().toISOString()
    };

    const updatedPatient = {
      ...patient,
      _id: targetId,
      id: targetId,
      severity: isRed ? 'CRITICAL_RED' : isYellow ? 'MODERATE_YELLOW' : 'LOW_GREEN',
      lastVitals: {
        bp: `${systolic}/${diastolic}`,
        pulse: Number(pulse),
        spO2: Number(spo2),
        temp: Number(temp) || 98.6,
        sugar: parsedSugar,
        bloodSugar: parsedSugar
      },
      lastTriage: triageRecord,
      customVitals: customVitals,
      fieldNotes: clinicalNotes,
      triageAudioNote: triageAudio,
      // Retain registrationAudioNote if it exists on patient
      registrationAudioNote: patient?.registrationAudioNote || null,
      status: 'QUEUED_FOR_TELEOPD',
      teleConsultRequested: true,
      hasNewUpdate: true,
      updatedAt: new Date().toISOString()
    };

    try {
      if (db?.patients) {
        await db.patients.put(updatedPatient);
      }

      if (targetId) {
        const res = await fetch(`/api/patients/${targetId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedPatient)
        });

        if (!res.ok) {
          await fetch(`/api/patients/${targetId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedPatient)
          });
        }
      }

      try {
        const bc = new BroadcastChannel('swasthya_teleopd_channel');
        bc.postMessage({ type: 'PATIENT_TRIAGE_UPDATED', payload: updatedPatient });
        bc.close();
      } catch (bcErr) {
        console.warn('Broadcast sync error:', bcErr);
      }

      if (onSaved) onSaved(updatedPatient);
      onClose();
    } catch (err) {
      console.error('Triage update error:', err);
      if (onSaved) onSaved(updatedPatient);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100 shadow-xs">
              <Activity className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tight">
                {lang === 'hi' ? 'क्लिनिकल ट्रायज एवं वाइटल्स मूल्यांकन' : 'Clinical AI Triage & Vitals Assessment'}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Patient: <span className="font-bold text-slate-800">{patient?.name}</span> ({patient?.age}y • {patient?.gender})
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          
          {/* Urgency Classification Card */}
          <div className={`p-4 rounded-2xl border ${triageResult.borderClass} transition-all`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black tracking-wider uppercase flex items-center gap-1.5 text-slate-800">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                AI Clinical Urgency Classification:
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${triageResult.badgeClass}`}>
                {triageResult.level}
              </span>
            </div>

            <div className="text-xs text-slate-700 space-y-1">
              <p className="font-bold text-slate-800">Detected Physiological Flags:</p>
              <ul className="list-disc list-inside text-slate-600 text-[11px] space-y-0.5">
                {triageResult.flags.map((flg, idx) => (
                  <li key={idx}>{flg}</li>
                ))}
              </ul>
              <p className="pt-2 text-[11px] font-semibold text-slate-800">
                <span className="text-slate-500">Recommended Action:</span> {triageResult.action}
              </p>
            </div>
          </div>

          {/* 6 Core Vitals + Dynamic Custom Vitals Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            
            {/* 1. Systolic */}
            <div className={`p-3 rounded-2xl border transition-all ${
              Number(systolic) >= 160 || Number(systolic) < 85 ? 'border-rose-300 bg-rose-50/40' :
              Number(systolic) >= 140 || Number(systolic) < 90 ? 'border-amber-300 bg-amber-50/40' :
              'border-slate-200 bg-slate-50/50'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">Systolic BP</label>
                {Number(systolic) >= 140 && (
                  <span className="text-[9px] font-black text-rose-600">HIGH</span>
                )}
              </div>
              <input
                type="number"
                value={systolic}
                onChange={(e) => setSystolic(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-mono text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            {/* 2. Diastolic */}
            <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50/50">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Diastolic BP (mmHg)</label>
              <input
                type="number"
                value={diastolic}
                onChange={(e) => setDiastolic(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-mono text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            {/* 3. Pulse */}
            <div className={`p-3 rounded-2xl border transition-all ${
              Number(pulse) > 115 || Number(pulse) < 50 ? 'border-rose-300 bg-rose-50/40' :
              Number(pulse) > 100 || Number(pulse) < 55 ? 'border-amber-300 bg-amber-50/40' :
              'border-slate-200 bg-slate-50/50'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">Pulse (bpm)</label>
                {(Number(pulse) > 100 || Number(pulse) < 55) && (
                  <span className="text-[9px] font-black text-amber-600">ABNORMAL</span>
                )}
              </div>
              <input
                type="number"
                value={pulse}
                onChange={(e) => setPulse(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-mono text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            {/* 4. SpO2 */}
            <div className={`p-3 rounded-2xl border transition-all ${
              Number(spo2) < 92 ? 'border-rose-300 bg-rose-50/40' :
              Number(spo2) < 94 ? 'border-amber-300 bg-amber-50/40' :
              'border-slate-200 bg-slate-50/50'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">SpO2 Oxygen (%)</label>
                {Number(spo2) < 94 && (
                  <span className="text-[9px] font-black text-rose-600">LOW</span>
                )}
              </div>
              <input
                type="number"
                value={spo2}
                onChange={(e) => setSpo2(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-mono text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            {/* 5. Temp */}
            <div className={`p-3 rounded-2xl border transition-all ${
              Number(temp) >= 102 ? 'border-rose-300 bg-rose-50/40' :
              Number(temp) >= 100.4 ? 'border-amber-300 bg-amber-50/40' :
              'border-slate-200 bg-slate-50/50'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">Temp (°F)</label>
                {Number(temp) >= 100.4 && (
                  <span className="text-[9px] font-black text-rose-600">FEVER</span>
                )}
              </div>
              <input
                type="number"
                step="0.1"
                value={temp}
                onChange={(e) => setTemp(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-mono text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            {/* 6. Respiratory Rate */}
            <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50/50">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Resp Rate (/min)</label>
              <input
                type="number"
                value={respRate}
                onChange={(e) => setRespRate(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-mono text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            {/* Custom Parameter Cards */}
            {customVitals.map((item) => {
              const status = evaluateCustomVital(item.title, item.value);
              
              const boxStyle = 
                status.severity === 'RED'
                  ? 'border-rose-400 bg-rose-50/60'
                  : status.severity === 'YELLOW'
                  ? 'border-amber-400 bg-amber-50/60'
                  : 'border-emerald-300 bg-emerald-50/40';

              const badgeStyle = 
                status.severity === 'RED'
                  ? 'bg-rose-100 text-rose-700 border-rose-200'
                  : status.severity === 'YELLOW'
                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                  : 'bg-emerald-100 text-emerald-800 border-emerald-200';

              return (
                <div key={item.id} className={`p-3 rounded-2xl border relative transition-all ${boxStyle}`}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-black text-slate-800 uppercase tracking-wider truncate max-w-[90px]" title={item.title}>
                      {item.title}
                    </label>
                    
                    <div className="flex items-center gap-1">
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase ${badgeStyle}`}>
                        {status.text}
                      </span>
                      <button 
                        type="button"
                        onClick={() => handleRemoveCustomVital(item.id)}
                        className="text-slate-400 hover:text-rose-600 transition-colors p-0.5"
                        title="Remove parameter"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <input
                    type="number"
                    step="any"
                    value={item.value}
                    onChange={(e) => {
                      const newVal = e.target.value;
                      setCustomVitals(prev => prev.map(v => v.id === item.id ? { ...v, value: newVal } : v));
                    }}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-mono text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 cursor-text"
                  />
                </div>
              );
            })}

            {/* Add Custom Vital Button/Box */}
            {isAddingCustom ? (
              <div className="p-3 rounded-2xl border-2 border-dashed border-teal-500 bg-teal-50/30 flex flex-col justify-between space-y-2">
                <div className="space-y-1.5">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Title (e.g. Sugar, Hb)"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-300 font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-600"
                  />
                  <input
                    type="number"
                    step="any"
                    placeholder="Value (e.g. 250)"
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                    className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-300 font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-600"
                  />
                </div>
                <div className="flex items-center gap-1.5 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingCustom(false);
                      setCustomTitle('');
                      setCustomValue('');
                    }}
                    className="px-2 py-1 text-[10px] font-bold text-slate-500 hover:bg-slate-200 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddCustomVital}
                    className="px-2.5 py-1 text-[10px] font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg flex items-center gap-1 shadow-xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>OK</span>
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAddingCustom(true)}
                className="p-3 rounded-2xl border-2 border-dashed border-slate-300 hover:border-teal-500 hover:bg-teal-50/30 text-slate-500 hover:text-teal-700 transition-all flex flex-col items-center justify-center gap-1 min-h-[76px]"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span className="text-[11px] font-bold tracking-tight">
                  {lang === 'hi' ? '+ अन्य पैरामीटर जोड़ें' : '+ Add Other Vital'}
                </span>
              </button>
            )}

          </div>

          {/* Clinical Notes & Triage Voice Note Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                {lang === 'hi' ? 'लक्षण एवं क्लिनिकल नोट्स' : 'Field Clinical Notes & Symptoms'}
              </label>

              {/* Record Triage Voice Note */}
              {!triageAudio && (
                <button
                  type="button"
                  onClick={isRecording ? stopAudioRecording : startAudioRecording}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    isRecording
                      ? 'bg-rose-600 text-white animate-pulse shadow-md shadow-rose-600/30'
                      : 'bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100'
                  }`}
                >
                  {isRecording ? <Square className="w-3.5 h-3.5 fill-current" /> : <Mic className="w-3.5 h-3.5" />}
                  <span>{isRecording ? `Recording... (${recordingSeconds}s)` : 'Record Triage Voice Note'}</span>
                </button>
              )}
            </div>

            {/* Written Field Notes Box */}
            <textarea
              rows="2"
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              placeholder="Type complaints, symptoms or observations manually..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
            />

            {/* Triage Voice Note Player / Preview */}
            {triageAudio && (
              <div className="p-3 bg-teal-50/80 border border-teal-200 rounded-2xl flex items-center justify-between gap-3 animate-fadeIn">
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={togglePlayAudio}
                    className="w-8 h-8 rounded-xl bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center shadow-xs transition-all"
                  >
                    {isPlayingAudio ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                  </button>
                  <div>
                    <p className="text-xs font-bold text-teal-950">Triage Voice Note Attached</p>
                    <p className="text-[10px] text-teal-700">Listen before syncing with Doctor</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={deleteAudioRecording}
                    className="px-2.5 py-1.5 rounded-xl text-rose-600 hover:bg-rose-100 text-xs font-bold transition-all flex items-center gap-1"
                    title="Delete and re-record"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>

                <audio
                  ref={audioPlayerRef}
                  src={triageAudio}
                  onEnded={() => setIsPlayingAudio(false)}
                  className="hidden"
                />
              </div>
            )}
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveTriage}
            className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-md shadow-teal-600/20 transition-all flex items-center gap-1.5 active:scale-95"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{lang === 'hi' ? 'सुरक्षित करें एवं सिंक करें' : 'Save & Sync Assessment'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}