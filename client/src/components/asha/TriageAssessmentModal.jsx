import React, { useState } from 'react';
import { 
  Heart, 
  Activity, 
  Thermometer, 
  Wind, 
  AlertTriangle, 
  CheckCircle2, 
  Mic, 
  MicOff, 
  X, 
  Plus, 
  Check 
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useSpeechRecognition } from '../../utils/useSpeechRecognition';
import { db } from '../../db/offlineDb';

export default function TriageAssessmentModal({ patient, onClose, onSaved }) {
  const { lang } = useLanguage();
  const { isListening, transcript, startListening, stopListening } = useSpeechRecognition();

  const [systolic, setSystolic] = useState(patient?.lastTriage?.bpSystolic || '120');
  const [diastolic, setDiastolic] = useState(patient?.lastTriage?.bpDiastolic || '80');
  const [pulse, setPulse] = useState(patient?.lastTriage?.pulse || '72');
  const [spo2, setSpo2] = useState(patient?.lastTriage?.spo2 || '98');
  const [temp, setTemp] = useState(patient?.lastTriage?.temp || '98.6');
  const [respRate, setRespRate] = useState(patient?.lastTriage?.respRate || '18');
  const [clinicalNotes, setClinicalNotes] = useState(patient?.fieldNotes || patient?.lastTriage?.notes || '');

  // Dynamic Extra Parameters State
  const [customVitals, setCustomVitals] = useState(patient?.lastTriage?.customVitals || []);
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customValue, setCustomValue] = useState('');

  // Evaluate single custom vital severity
  const evaluateCustomVital = (title, valStr) => {
    const val = parseFloat(valStr);
    const tLower = (title || '').toLowerCase().trim();

    if (isNaN(val)) return { severity: 'NORMAL', text: 'NORMAL' };

    // 1. Temperature / Fever
    if (tLower.includes('temp') || tLower.includes('fever') || tLower.includes('bukhar')) {
      if (val >= 102) return { severity: 'RED', text: 'HIGH FEVER', flag: `Critical Fever (${val} °F)` };
      if (val >= 100.4) return { severity: 'YELLOW', text: 'MODERATE FEVER', flag: `Moderate Fever (${val} °F)` };
      if (val < 95) return { severity: 'RED', text: 'HYPOTHERMIA', flag: `Hypothermia (${val} °F)` };
      return { severity: 'GREEN', text: 'NORMAL' };
    }

    // 2. Blood Sugar / Glucose (Random mg/dL)
    if (tLower.includes('sugar') || tLower.includes('glucose') || tLower.includes('rbs') || tLower.includes('fbs')) {
      if (val >= 250 || val < 60) return { severity: 'RED', text: 'CRITICAL SUGAR', flag: `Critical Blood Sugar (${val} mg/dL)` };
      if (val >= 180 || val < 70) return { severity: 'YELLOW', text: 'ABNORMAL SUGAR', flag: `Elevated Sugar (${val} mg/dL)` };
      return { severity: 'GREEN', text: 'NORMAL' };
    }

    // 3. Hemoglobin (Hb in g/dL)
    if (tLower.includes('hb') || tLower.includes('hemo') || tLower.includes('anemia')) {
      if (val < 7) return { severity: 'RED', text: 'SEVERE ANEMIA', flag: `Severe Low Hemoglobin (${val} g/dL)` };
      if (val < 10) return { severity: 'YELLOW', text: 'MILD ANEMIA', flag: `Mild Low Hemoglobin (${val} g/dL)` };
      return { severity: 'GREEN', text: 'NORMAL' };
    }

    // 4. Generic / Other numbers (fallback threshold for extreme values)
    if (val >= 200 || val <= 30) {
      return { severity: 'YELLOW', text: 'ABNORMAL', flag: `Abnormal ${title} (${val})` };
    }

    return { severity: 'GREEN', text: 'NORMAL' };
  };

  // Handle adding custom vital
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

  // Rule-based AI Urgency Classifier with dynamic Custom Vitals calculation
  const calculateUrgency = () => {
    const sys = Number(systolic);
    const dia = Number(diastolic);
    const sp = Number(spo2);
    const pr = Number(pulse);
    const tm = Number(temp);

    const flags = [];
    let hasCustomRed = false;
    let hasCustomYellow = false;

    // Check Core Vitals
    if (sys >= 160 || sys < 85) flags.push(`Critical Blood Pressure (${sys}/${dia} mmHg)`);
    else if (sys >= 140 || sys < 90) flags.push(`Abnormal Blood Pressure (${sys}/${dia} mmHg)`);

    if (sp < 92) flags.push(`Critical Oxygen Saturation (${sp}%)`);
    else if (sp < 94) flags.push(`Low Oxygen Saturation (${sp}%)`);

    if (pr > 115 || pr < 50) flags.push(`Critical Pulse Rate (${pr} bpm)`);
    else if (pr > 100 || pr < 55) flags.push(`Abnormal Heart Rate (${pr} bpm)`);

    if (tm >= 102) flags.push(`High Fever (${tm} °F)`);
    else if (tm >= 100.4) flags.push(`Moderate Fever (${tm} °F)`);

    // Check All Custom Vitals dynamically
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
    const triageRecord = {
      severity: triageResult.level.includes('RED') ? 'RED' : triageResult.level.includes('YELLOW') ? 'YELLOW' : 'GREEN',
      bpSystolic: Number(systolic),
      bpDiastolic: Number(diastolic),
      pulse: Number(pulse),
      spo2: Number(spo2),
      temp: Number(temp),
      respRate: Number(respRate),
      notes: clinicalNotes,
      customVitals,
      timestamp: new Date().toISOString()
    };

    const updatedPatient = {
      ...patient,
      lastTriage: triageRecord,
      severity: triageResult.level.includes('RED') ? 'CRITICAL_RED' : triageResult.level.includes('YELLOW') ? 'MODERATE_YELLOW' : 'LOW_GREEN',
      fieldNotes: clinicalNotes,
      status: 'QUEUED_FOR_TELEOPD',
      teleConsultRequested: true,
      updatedAt: new Date().toISOString()
    };

    try {
      // 1. Local IndexedDB save
      await db.patients.put(updatedPatient);

      // 2. Direct Backend Sync (Check MongoDB real ObjectId vs Mock ID)
      const targetId = patient._id || patient.id;
      let syncSuccess = false;

      if (targetId && !String(targetId).startsWith('pat_')) {
        // Real MongoDB ID hai toh PUT update karega
        try {
          const res = await fetch(`/api/patients/${targetId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedPatient)
          });
          if (res.ok) syncSuccess = true;
        } catch (e) {
          console.warn('PUT failed, trying fallback...');
        }
      }

      // Agar mock id thi ya record server par nahi tha, toh naya POST karega
      if (!syncSuccess) {
        const { _id, id, ...cleanData } = updatedPatient;
        const postRes = await fetch('/api/patients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cleanData)
        });
        if (postRes.ok) {
          const savedData = await postRes.json();
          // Server se mili real _id IndexedDB me update kar dega
          await db.patients.put({ ...updatedPatient, _id: savedData._id, id: savedData._id });
        }
      }

      if (onSaved) onSaved(updatedPatient);
      onClose();
    } catch (err) {
      console.error('Triage sync error:', err);
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

            {/* Added Custom Parameter Cards with Dynamic Red/Yellow/Green Feedback */}
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

            {/* Inline Add Box OR Click to Open Add Box */}
            {isAddingCustom ? (
              <div className="p-3 rounded-2xl border-2 border-dashed border-teal-500 bg-teal-50/30 flex flex-col justify-between space-y-2">
                <div className="space-y-1.5">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Title (e.g. Temp, Sugar)"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-300 font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-600"
                  />
                  <input
                    type="number"
                    step="any"
                    placeholder="Value (e.g. 105)"
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
                    <Check className="w-3 h-3" />
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

          {/* Clinical Notes Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                {lang === 'hi' ? 'लक्षण एवं क्लिनिकल नोट्स' : 'Field Clinical Notes & Symptoms'}
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
              rows="3"
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              placeholder="Record any complaints, signs or symptoms observed..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
            />
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
            className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-md shadow-teal-600/20 transition-all flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{lang === 'hi' ? 'सुरक्षित करें एवं सिंक करें' : 'Save & Sync Assessment'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}