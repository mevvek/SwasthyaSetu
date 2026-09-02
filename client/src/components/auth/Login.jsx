import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  Activity, 
  ShieldCheck, 
  Stethoscope, 
  UserCheck, 
  Building2, 
  Lock, 
  Mail, 
  Phone, 
  KeyRound, 
  ArrowRight,
  Sparkles
} from 'lucide-react';

export default function Login() {
  const { loginWithRole } = useAuth();
  
  const [selectedRole, setSelectedRole] = useState('ASHA_WORKER');
  const [loginMethod, setLoginMethod] = useState('OTP'); // 'OTP' or 'PASSWORD'
  const [phone, setPhone] = useState('9876543210');
  const [email, setEmail] = useState('asha.sunita@swasthyasetu.gov.in');
  const [password, setPassword] = useState('••••••••');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const roleMeta = {
    ASHA_WORKER: {
      tabLabel: 'ASHA',
      title: 'ASHA Field Worker',
      desc: 'Offline sync registry, clinical triage & maternal care monitoring',
      icon: UserCheck,
      color: 'teal',
      demoPhone: '9876543210',
      demoEmail: 'asha.sunita@swasthyasetu.gov.in'
    },
    DOCTOR: {
      tabLabel: 'Doctor',
      title: 'Medical Officer (Doctor)',
      desc: 'Tele-consultation OPD, digital Rx & live emergency triage streams',
      icon: Stethoscope,
      color: 'emerald',
      demoPhone: '9811223344',
      demoEmail: 'dr.sharma@phc-up.gov.in'
    },
    ADMIN: {
      tabLabel: 'Admin / CMO',
      title: 'PHC Admin / CMO Hub',
      desc: 'Real-time PHC logistics, drug stock replenishment & district surveillance',
      icon: Building2,
      color: 'indigo',
      demoPhone: '9900112233',
      demoEmail: 'cmo.admin@swasthyasetu.gov.in'
    }
  };

  const handleRoleChange = (role) => {
    setSelectedRole(role);
    setPhone(roleMeta[role].demoPhone);
    setEmail(roleMeta[role].demoEmail);
    setOtpSent(false);
    setOtp('');
  };

  const handleSendOtp = () => {
    if (!phone) return;
    setIsLoading(true);
    setTimeout(() => {
      setOtpSent(true);
      setOtp('7482'); // Hardcoded clinical demo OTP
      setIsLoading(false);
    }, 500);
  };

  const handleAuthSubmit = (e) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      loginWithRole(selectedRole);
      setIsLoading(false);
    }, 400);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden">
      
      {/* Background Decorative Glow */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Main Container Card */}
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100/20 overflow-hidden relative z-10 backdrop-blur-xl">
        
        {/* Top Header Section */}
        <div className="bg-slate-950 p-6 sm:p-8 text-white relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-teal-500 flex items-center justify-center text-white shadow-lg shadow-teal-500/30">
                <Activity className="w-7 h-7 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black tracking-tight text-white">SwasthyaSetu</h1>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                    SIH Edition
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">Rural Healthcare Infrastructure Portal</p>
              </div>
            </div>
            
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-bold text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
              ABDM Compliant
            </div>
          </div>

          <p className="text-xs text-slate-300 mt-4 leading-relaxed">
            Role-Based Clinical Authentication Gateway. Select your operational post below.
          </p>
        </div>

        {/* Form & Selection Body */}
        <div className="p-6 sm:p-8 space-y-6">
          
          {/* Role Switcher Tabs */}
          <div>
            <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-2.5">
              Select Operational Role
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {Object.entries(roleMeta).map(([roleKey, meta]) => {
                const IconComponent = meta.icon;
                const isSelected = selectedRole === roleKey;
                return (
                  <button
                    key={roleKey}
                    type="button"
                    onClick={() => handleRoleChange(roleKey)}
                    className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                      isSelected
                        ? 'border-teal-600 bg-teal-50/70 text-teal-950 font-bold ring-2 ring-teal-500/20 shadow-sm'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isSelected ? 'bg-teal-600 text-white shadow-sm' : 'bg-white text-slate-500 border border-slate-200'}`}>
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] tracking-tight font-bold">{meta.tabLabel}</span>
                  </button>
                );
              })}
            </div>

            {/* Selected Role Meta Note */}
            <div className="mt-3 p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-600 flex items-start gap-2">
              <Sparkles className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
              <span>{roleMeta[selectedRole].desc}</span>
            </div>
          </div>

          {/* Authentication Mode Pill Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setLoginMethod('OTP')}
              className={`flex-1 py-2 rounded-lg transition-all text-center ${
                loginMethod === 'OTP' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Secure Mobile OTP
            </button>
            <button
              type="button"
              onClick={() => setLoginMethod('PASSWORD')}
              className={`flex-1 py-2 rounded-lg transition-all text-center ${
                loginMethod === 'PASSWORD' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Govt ID & Password
            </button>
          </div>

          {/* Auth Input Fields Form */}
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            
            {loginMethod === 'OTP' ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Registered Medical Mobile Number</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full pl-10 pr-24 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
                    />
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={isLoading || otpSent}
                      className="absolute right-2 top-2 px-3 py-1 bg-teal-100 hover:bg-teal-200 text-teal-800 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                    >
                      {otpSent ? 'Resend' : 'Send OTP'}
                    </button>
                  </div>
                </div>

                {otpSent && (
                  <div className="animate-fade-in">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Enter 4-Digit Clinical Token (Demo OTP: <span className="text-teal-600 font-mono font-black">7482</span>)
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        maxLength="4"
                        required
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        placeholder="7482"
                        className="w-full pl-10 pr-3 py-2.5 text-sm rounded-xl border border-teal-300 bg-teal-50/40 focus:outline-none focus:ring-2 focus:ring-teal-600 font-mono tracking-widest text-center font-bold text-teal-900"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Official NIC / Healthcare Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-3 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-3 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Quick Demo Pre-fill Pill Bar */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
              <span>Testing Account:</span>
              <button
                type="button"
                onClick={() => {
                  setPhone(roleMeta[selectedRole].demoPhone);
                  setOtp('7482');
                  setOtpSent(true);
                }}
                className="text-teal-700 font-bold hover:underline"
              >
                Auto-fill demo credentials
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || (loginMethod === 'OTP' && !otpSent)}
              className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 active:scale-[0.99] text-white font-bold text-xs rounded-xl shadow-lg shadow-teal-600/25 transition-all uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                'Verifying Credentials...'
              ) : (
                <>
                  Access {roleMeta[selectedRole].title}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

          </form>

        </div>

      </div>

      {/* Footer Branding Note */}
      <p className="text-[11px] text-slate-400 text-center mt-6 relative z-10 font-medium">
        SwasthyaSetu • Ministry of Health & Family Welfare Integration Portal
      </p>

    </div>
  );
}