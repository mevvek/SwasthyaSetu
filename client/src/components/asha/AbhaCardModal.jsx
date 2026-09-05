import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Shield, X, Printer, CheckCircle2 } from 'lucide-react';

export default function AbhaCardModal({ patient, onClose }) {
  if (!patient) return null;

  // Mock FHIR R4 Patient Resource representation
  const fhirPayload = JSON.stringify({
    resourceType: "Patient",
    id: patient.id,
    identifier: [
      {
        system: "https://healthid.abdm.gov.in",
        value: patient.abhaId
      }
    ],
    name: [{ text: patient.name }],
    gender: patient.gender?.toLowerCase(),
    address: [{ text: patient.village, state: "Uttar Pradesh", country: "India" }],
    category: patient.category
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200">
        
        {/* Modal Header */}
        <div className="flex justify-between items-center pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-teal-600" />
            <h3 className="text-base font-bold text-slate-900">ABHA Digital Health Pass</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Card Design */}
        <div className="mt-4 p-5 bg-gradient-to-br from-teal-700 via-teal-800 to-slate-900 rounded-3xl text-white shadow-xl relative overflow-hidden">
          
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-teal-200">
                Ayushman Bharat Digital Mission
              </span>
              <h2 className="text-lg font-black tracking-tight mt-0.5">SwasthyaSetu ID</h2>
            </div>
            <div className="p-1.5 bg-white/10 rounded-xl backdrop-blur-md">
              <Shield className="w-5 h-5 text-teal-300" />
            </div>
          </div>

          <div className="my-5 flex items-center gap-4">
            <div className="p-2 bg-white rounded-2xl shadow-md shrink-0">
              <QRCodeSVG value={fhirPayload} size={84} level="M" />
            </div>

            <div>
              <p className="text-sm font-bold">{patient.name}</p>
              <p className="text-xs text-teal-100">{patient.age} Yrs • {patient.gender}</p>
              <p className="text-[11px] text-teal-200/90 font-medium mt-0.5">{patient.village}</p>
              <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-white/20 text-teal-50">
                {patient.category}
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-white/10 flex justify-between items-center">
            <div>
              <span className="text-[9px] uppercase font-semibold text-teal-300">ABHA Address No.</span>
              <p className="text-xs font-mono font-bold tracking-widest">{patient.abhaId}</p>
            </div>
            <span className="text-[9px] font-semibold text-emerald-300 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> FHIR Standard
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex gap-2 mt-5">
          <button
            onClick={handlePrint}
            className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-teal-600/20"
          >
            <Printer className="w-4 h-4" /> Print / Save PDF
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}