import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Activity, ShieldCheck, Stethoscope, UserCheck, Building2, Lock, Phone } from 'lucide-react';

export default function LoginModal() {
  const { login, loading } = useAuth();
  const [selectedRole, setSelectedRole] = useState('ASHA_WORKER');
  const [phone, setPhone] = useState('9876543210');
  const [password, setPassword] = useState('password123');
  const [errorMsg, setErrorMsg] = useState('');

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    const res = await login(phone, password, selectedRole);
    if (!res.success) {
      setErrorMsg(res.message || 'Authentication failed. Please verify credentials.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-xl border border-slate-200">
        
        {/* Header Branding */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-lg shadow-teal-600/20">
            <Activity className="w-7 h-7 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-1.5">
              SwasthyaSetu
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                SIH Edition
              </span>
            </h1>
            <p className="text-xs text-slate-500">Rural Tele-Medicine & Health Management</p>
          </div>
        </div>

        {/* Role Picker */}
        <div className="mb-5">
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Select Healthcare Access Role
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setSelectedRole('ASHA_WORKER')}
              className={`p-2.5 rounded-2xl border text-center transition-all ${
                selectedRole === 'ASHA_WORKER'
                  ? 'border-teal-600 bg-teal-50 text-teal-900 font-bold ring-2 ring-teal-600/20'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <UserCheck className="w-4 h-4 mx-auto mb-1 text-teal-600" />
              <span className="text-xs">ASHA</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedRole('DOCTOR')}
              className={`p-2.5 rounded-2xl border text-center transition-all ${
                selectedRole === 'DOCTOR'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold ring-2 ring-emerald-600/20'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Stethoscope className="w-4 h-4 mx-auto mb-1 text-emerald-600" />
              <span className="text-xs">Doctor</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedRole('ADMIN')}
              className={`p-2.5 rounded-2xl border text-center transition-all ${
                selectedRole === 'ADMIN'
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold ring-2 ring-indigo-600/20'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Building2 className="w-4 h-4 mx-auto mb-1 text-indigo-600" />
              <span className="text-xs">Admin</span>
            </button>
          </div>
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Registered Phone / ID</label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Passcode / PIN</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
              />
            </div>
          </div>

          {errorMsg && (
            <p className="text-xs text-rose-600 font-semibold bg-rose-50 p-2 rounded-xl border border-rose-200">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-teal-600 hover:bg-teal-700 active:scale-[0.99] text-white font-bold text-xs rounded-xl shadow-lg shadow-teal-600/20 transition-all uppercase tracking-wider flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            {loading ? 'Authenticating...' : 'Secure Sign In'}
          </button>
        </form>

      </div>
    </div>
  );
}