import React from 'react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { BellRing, Check, X } from 'lucide-react';

export default function EmergencyBanner() {
  const { activeEmergency, clearEmergency } = useSocket();
  const { user } = useAuth();

  // Condition: Never display on ASHA screen. Only show to Doctor / Admin.
  if (!activeEmergency || user?.role === 'ASHA_WORKER') return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] max-w-md w-full bg-rose-600 text-white p-4 rounded-2xl shadow-2xl border border-rose-500 animate-bounce">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <BellRing className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider bg-white text-rose-700 px-2 py-0.5 rounded">
                CRITICAL RED ALERT
              </span>
              <span className="text-[10px] text-rose-100">Live Tele-OPD Broadcast</span>
            </div>
            <h4 className="text-sm font-bold mt-1">
              {activeEmergency.name} ({activeEmergency.age}y, {activeEmergency.gender})
            </h4>
            <p className="text-xs text-rose-100">{activeEmergency.village} • BP: {activeEmergency.vitals?.bp}</p>
          </div>
        </div>
        <button
          onClick={clearEmergency}
          className="p-1 rounded-lg hover:bg-white/20 text-white/80 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {activeEmergency.redFlags?.length > 0 && (
        <div className="mt-2 text-xs bg-black/20 p-2 rounded-xl border border-white/10">
          <p className="font-semibold text-rose-100">{activeEmergency.redFlags[0]}</p>
        </div>
      )}

      <div className="flex gap-2 mt-3 pt-2 border-t border-white/10">
        <button
          onClick={clearEmergency}
          className="w-full py-1.5 bg-white text-rose-700 font-bold text-xs rounded-xl shadow-sm hover:bg-rose-50 transition-all flex items-center justify-center gap-1"
        >
          <Check className="w-3.5 h-3.5" /> Acknowledge Critical Alert
        </button>
      </div>
    </div>
  );
}