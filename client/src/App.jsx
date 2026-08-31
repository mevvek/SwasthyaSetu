import React from 'react';
import { Activity, ShieldCheck } from 'lucide-react';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
      <div className="bg-slate-800 p-6 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-4">
        <Activity className="w-10 h-10 text-emerald-400 animate-pulse" />
        <div>
          <h1 className="text-2xl font-bold text-emerald-400">SIH26133 Rural Health</h1>
          <p className="text-slate-400 text-sm flex items-center gap-1 mt-1">
            <ShieldCheck className="w-4 h-4 text-emerald-500" /> Client & Tailwind v4 Configured
          </p>
        </div>
      </div>
    </div>
  );
}