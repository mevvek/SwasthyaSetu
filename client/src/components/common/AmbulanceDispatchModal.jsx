import React, { useState } from 'react';
import { Truck, CheckCircle2, PhoneCall, Clock, MapPin, X, ShieldAlert } from 'lucide-react';

export default function AmbulanceDispatchModal({ patient, onClose, onConfirmDispatch }) {
  const [dispatched, setDispatched] = useState(false);

  // Realistic mock dispatch metadata
  const mockDispatchInfo = {
    vehicleNumber: 'UP-72-G-4012 (ALS Ambulance)',
    pilotName: 'Ramesh Yadav',
    pilotPhone: '+91 94150 XXXXX',
    etaMinutes: 14,
    destinationHub: 'District Hospital / FRU Trauma Center'
  };

  const handleDispatch = () => {
    onConfirmDispatch({
      patientId: patient._id || patient.id,
      patientName: patient.name,
      village: patient.village,
      ...mockDispatchInfo
    });
    setDispatched(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
              108 Emergency FRU Dispatch
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!dispatched ? (
          <div className="mt-4 space-y-4">
            <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200 text-xs text-rose-900">
              <div className="flex items-center gap-1.5 font-bold mb-1">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                Critical Referral Protocol
              </div>
              <p>
                Initiating immediate emergency transport for <span className="font-bold">{patient.name}</span> ({patient.village}).
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Pickup Location:</span>
                <span className="font-bold text-slate-800 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-400" /> {patient.village} Sector Hub
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Assigned Unit:</span>
                <span className="font-bold text-slate-800 font-mono">108 ALS Unit #4</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Destination Facility:</span>
                <span className="font-bold text-slate-800">Kunda CHC / District Hospital</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDispatch}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-600/20"
              >
                Dispatch Ambulance
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div>
              <h4 className="text-sm font-bold text-slate-900">Emergency Unit Dispatched</h4>
              <p className="text-xs text-slate-500 mt-0.5">Real-time tracking link broadcasted across network.</p>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-left text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Vehicle:</span>
                <span className="font-bold font-mono text-slate-800">{mockDispatchInfo.vehicleNumber}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Estimated Arrival (ETA):</span>
                <span className="font-bold text-emerald-700 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {mockDispatchInfo.etaMinutes} Minutes
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Driver Contact:</span>
                <span className="font-bold text-slate-800 flex items-center gap-1 font-mono">
                  <PhoneCall className="w-3 h-3 text-slate-400" /> {mockDispatchInfo.pilotPhone}
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
            >
              Close Tracker
            </button>
          </div>
        )}

      </div>
    </div>
  );
}