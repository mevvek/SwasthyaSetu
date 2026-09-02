import React, { useState } from 'react';
import { 
  FileText, 
  X, 
  Plus, 
  Trash2, 
  Printer, 
  CheckCircle2, 
  Sparkles,
  Pill,
  User,
  MapPin
} from 'lucide-react';

export default function PrescriptionModal({ patient, onClose }) {
  const [medicines, setMedicines] = useState([
    { name: 'Paracetamol 650mg', dosage: '1 tablet TDS (after meals)', days: '5 Days' },
    { name: 'ORS Sachet', dosage: '1 packet in 1L boiled water', days: '3 Days' }
  ]);

  const [newMed, setNewMed] = useState({ name: '', dosage: '', days: '' });
  const [clinicalAdvice, setClinicalAdvice] = useState('Maintain proper hydration, bed rest, and report immediately if fever spikes above 101°F.');
  const [isSaved, setIsSaved] = useState(false);

  const handleAddMedicine = (e) => {
    e.preventDefault();
    if (!newMed.name || !newMed.dosage) return;
    setMedicines([...medicines, newMed]);
    setNewMed({ name: '', dosage: '', days: '' });
  };

  const handleRemoveMedicine = (idx) => {
    setMedicines(medicines.filter((_, i) => i !== idx));
  };

  const handleSaveRx = () => {
    setIsSaved(true);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm font-sans">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-950 p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-500 flex items-center justify-center text-white">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight">Digital Clinical Prescription (Rx)</h2>
              <p className="text-[11px] text-slate-400">National Medical Commission (NMC) Tele-OPD Format</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Patient Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div>
            <p className="font-bold text-slate-900 text-sm">{patient?.patientName || patient?.name}</p>
            <p className="text-slate-500">{patient?.gender}, {patient?.age} yrs • ID: {patient?._id || patient?.id}</p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-slate-700">{patient?.village}</p>
            <p className="text-slate-500 text-[11px]">Phone: {patient?.phone || 'N/A'}</p>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* Medicine List */}
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">
              Prescribed Medicines
            </label>
            <div className="space-y-2">
              {medicines.map((m, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                  <div className="flex items-center gap-2.5">
                    <Pill className="w-4 h-4 text-teal-600 shrink-0" />
                    <div>
                      <p className="font-bold text-slate-800">{m.name}</p>
                      <p className="text-slate-500 text-[11px]">{m.dosage} • {m.days}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveMedicine(idx)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Add Medicine Inline */}
          <div className="p-4 rounded-2xl bg-teal-50/40 border border-teal-200/70 space-y-3">
            <p className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-teal-600" />
              Add Medication
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Medicine Name"
                value={newMed.name}
                onChange={(e) => setNewMed({ ...newMed, name: e.target.value })}
                className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-medium"
              />
              <input
                type="text"
                placeholder="Dosage (e.g. BD / TDS)"
                value={newMed.dosage}
                onChange={(e) => setNewMed({ ...newMed, dosage: e.target.value })}
                className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-medium"
              />
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Duration (e.g. 5 Days)"
                  value={newMed.days}
                  onChange={(e) => setNewMed({ ...newMed, days: e.target.value })}
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-medium"
                />
                <button
                  type="button"
                  onClick={handleAddMedicine}
                  className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shrink-0"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Advice / Notes */}
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-1.5">
              Doctor's Clinical Advice & Follow-up Instructions
            </label>
            <textarea
              rows="3"
              value={clinicalAdvice}
              onChange={(e) => setClinicalAdvice(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            <Sparkles className="w-3.5 h-3.5 text-teal-600" />
            <span>Digital Signature verified via ABDM</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveRx}
              className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-600/20 transition-all flex items-center gap-1.5"
            >
              {isSaved ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Prescription Saved</span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  <span>Generate Digital Rx</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}