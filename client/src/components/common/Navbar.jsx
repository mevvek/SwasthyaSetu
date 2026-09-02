import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { 
  Activity, 
  LogOut, 
  Globe, 
  Wifi, 
  WifiOff, 
  User 
} from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { lang, toggleLanguage, t } = useLanguage();
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getRoleBadge = (role) => {
    switch (role) {
      case 'ASHA_WORKER':
        return { label: lang === 'hi' ? 'आशा (ASHA)' : 'ASHA Worker', color: 'bg-emerald-50 text-emerald-800 border-emerald-300' };
      case 'DOCTOR':
        return { label: 'Doctor (MO)', color: 'bg-blue-50 text-blue-800 border-blue-300' };
      case 'ADMIN':
        return { label: 'PHC Admin / CMO', color: 'bg-indigo-50 text-indigo-800 border-indigo-300' };
      default:
        return { label: role, color: 'bg-slate-50 text-slate-800 border-slate-300' };
    }
  };

  const badge = getRoleBadge(user?.role);

  return (
    <nav className="bg-slate-950 text-white border-b border-slate-800 sticky top-0 z-40 px-4 sm:px-6 py-3 shadow-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        
        {/* Left Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center text-white shadow-md shadow-teal-500/20">
            <Activity className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-black tracking-tight text-white">SwasthyaSetu</span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30 uppercase">
                SIH
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block">Rural Healthcare Infrastructure Portal</p>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          
          {/* Online/Offline Pill */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border ${
            isOnline ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300' : 'bg-rose-950/60 border-rose-800 text-rose-300 animate-pulse'
          }`}>
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span className="hidden md:inline">{isOnline ? 'Online' : 'Offline Mode'}</span>
          </div>

          {/* Language Switcher Pill: SIRF ASHA Worker ke liye dikhega */}
          {user?.role === 'ASHA_WORKER' && (
            <button
              type="button"
              onClick={() => toggleLanguage()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-teal-300 transition-all active:scale-95 shadow-sm"
              title="Switch Language"
            >
              <Globe className="w-3.5 h-3.5 text-teal-400" />
              <span>{lang === 'en' ? 'हिन्दी' : 'English'}</span>
            </button>
          )}

          {/* Staff Profile Badge */}
          <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-800">
            <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
              <User className="w-4 h-4" />
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-white leading-none">{user?.name || 'Dr. Arvind Sharma (MO)'}</p>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border inline-block mt-1 ${badge.color}`}>
                {badge.label}
              </span>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-500/30 text-xs font-bold transition-all ml-1"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>

        </div>

      </div>
    </nav>
  );
}