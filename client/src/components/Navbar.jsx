import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Activity, User, LogOut, Shield, Stethoscope, Building2 } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();

  const getRoleBadge = (role) => {
    switch (role) {
      case 'DOCTOR':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <Stethoscope className="w-3.5 h-3.5" /> Doctor Portal
          </span>
        );
      case 'PHC_ADMIN':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-300">
            <Building2 className="w-3.5 h-3.5" /> CMO / Admin
          </span>
        );
      case 'ASHA_WORKER':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-teal-100 text-teal-800 border border-teal-300">
            <Shield className="w-3.5 h-3.5" /> ASHA Field Portal
          </span>
        );
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo & Facility Tag */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-md shadow-teal-600/20">
              <Activity className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-slate-900 tracking-tight">SwasthyaSetu</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                  SIH26133
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {user ? user.phcCenter : 'Rural Health Care Network'}
              </p>
            </div>
          </div>

          {/* User Status & Role Switcher Actions */}
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <div className="hidden sm:block">{getRoleBadge(user.role)}</div>
                <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                  <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-600 font-semibold text-xs">
                    {user.name?.charAt(0) || 'U'}
                  </div>
                  <div className="hidden md:block text-left">
                    <p className="text-xs font-bold text-slate-800 leading-none">{user.name}</p>
                    <p className="text-[11px] text-slate-500 capitalize">{user.role?.toLowerCase().replace('_', ' ')}</p>
                  </div>
                  <button
                    onClick={logout}
                    title="Sign Out"
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-1"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="text-xs font-semibold text-teal-700 bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-200">
                Offline Ready System
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}