import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
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
  Sparkles,
  Globe
} from 'lucide-react';

const BACKGROUND_SLIDES = [
  { url: '/bg-1.jpg' },
  { url: '/bg-2.jpg' },
  { url: '/bg-3.jpg' },
  { url: '/bg-4.jpg' }
];

export default function Login() {
  const { loginWithRole } = useAuth();
  const { lang, toggleLanguage, t } = useLanguage();
  
  const [currentSlide, setCurrentSlide] = useState(0);
  const [selectedRole, setSelectedRole] = useState('ASHA_WORKER');
  const [loginMethod, setLoginMethod] = useState('OTP');
  const [phone, setPhone] = useState('9876543210');
  const [email, setEmail] = useState('asha.sunita@swasthyasetu.gov.in');
  const [password, setPassword] = useState('••••••••');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % BACKGROUND_SLIDES.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const roleMeta = {
    ASHA_WORKER: {
      tabLabel: t.ashaTab,
      title: t.ashaTitle,
      desc: t.ashaDesc,
      icon: UserCheck,
      demoPhone: '9876543210',
      demoEmail: 'asha.sunita@swasthyasetu.gov.in'
    },
    DOCTOR: {
      tabLabel: t.doctorTab,
      title: t.doctorTitle,
      desc: t.doctorDesc,
      icon: Stethoscope,
      demoPhone: '9811223344',
      demoEmail: 'dr.sharma@phc-up.gov.in'
    },
    ADMIN: {
      tabLabel: t.adminTab,
      title: t.adminTitle,
      desc: t.adminDesc,
      icon: Building2,
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
      setOtp('7482');
      setIsLoading(false);
    }, 400);
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
    <div className="relative min-h-screen w-full flex items-center justify-end overflow-hidden bg-slate-950 font-sans">
      
      {/* Background Slideshow Layer */}
      {BACKGROUND_SLIDES.map((slide, idx) => (
        <div
          key={idx}
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
            idx === currentSlide ? 'opacity-100 scale-100' : 'opacity-0 pointer-events-none'
          }`}
          style={{
            backgroundImage: `url(${slide.url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center left'
          }}
        />
      ))}

      {/* Subtle Right-Side Gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-950/30 to-slate-950/75 pointer-events-none" />

      {/* Prominent Language Switcher at Top-Right of the Screen/Image */}
      <div className="absolute top-6 right-6 sm:top-8 sm:right-12 z-30 flex items-center gap-3">
        <button
          type="button"
          onClick={() => toggleLanguage()}
          className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-900/80 hover:bg-slate-900 backdrop-blur-md border border-white/20 text-xs font-bold text-white shadow-xl hover:scale-105 active:scale-95 transition-all"
        >
          <Globe className="w-4 h-4 text-teal-400" />
          <span className="tracking-wide">
            {lang === 'en' ? 'हिन्दी में बदलें' : 'Switch to English'}
          </span>
          <span className="px-1.5 py-0.5 rounded-lg bg-teal-500/20 text-[10px] font-black text-teal-300 border border-teal-500/30 uppercase">
            {lang === 'en' ? 'HI' : 'EN'}
          </span>
        </button>
      </div>

      {/* Slide Dots Indicator at Bottom-Left */}
      <div className="absolute bottom-6 left-8 z-20 hidden sm:flex items-center gap-2">
        {BACKGROUND_SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentSlide(i)}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === currentSlide ? 'w-8 bg-teal-400' : 'w-2 bg-white/40 hover:bg-white/70'
            }`}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>

      {/* 10% Enlarged Login Card */}
      <div className="relative z-10 w-full max-w-[495px] my-6 mr-4 sm:mr-10 lg:mr-14 bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-white/30 overflow-hidden shrink-0">
        
        {/* Top Header */}
        <div className="bg-slate-950 p-7 text-white relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-teal-500 flex items-center justify-center text-white shadow-md shadow-teal-500/30 shrink-0">
                <Activity className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black tracking-tight text-white">SwasthyaSetu</h2>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                    SIH Edition
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{t.portalSubtitle}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-bold text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
              ABDM
            </div>
          </div>

          <p className="text-xs text-slate-300 mt-3.5 leading-relaxed">
            {t.portalTagline}
          </p>
        </div>

        {/* Form Body with Expanded Padding */}
        <div className="p-7 space-y-5">
          
          {/* Role Select Tabs */}
          <div>
            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">
              {t.selectRole}
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {Object.entries(roleMeta).map(([roleKey, meta]) => {
                const IconComp = meta.icon;
                const isSelected = selectedRole === roleKey;
                return (
                  <button
                    key={roleKey}
                    type="button"
                    onClick={() => handleRoleChange(roleKey)}
                    className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                      isSelected
                        ? 'border-teal-600 bg-teal-50 text-teal-950 font-bold ring-2 ring-teal-500/20 shadow-sm'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isSelected ? 'bg-teal-600 text-white shadow-sm' : 'bg-white text-slate-500 border border-slate-200'}`}>
                      <IconComp className="w-4 h-4" />
                    </div>
                    <span className="text-xs tracking-tight">{meta.tabLabel}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
              <span className="leading-snug">{roleMeta[selectedRole].desc}</span>
            </div>
          </div>

          {/* Auth Mode Tabs */}
          <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setLoginMethod('OTP')}
              className={`flex-1 py-2 rounded-lg transition-all text-center ${
                loginMethod === 'OTP' ? 'bg-white text-teal-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.otpMode}
            </button>
            <button
              type="button"
              onClick={() => setLoginMethod('PASSWORD')}
              className={`flex-1 py-2 rounded-lg transition-all text-center ${
                loginMethod === 'PASSWORD' ? 'bg-white text-teal-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.pwdMode}
            </button>
          </div>

          {/* Form Fields */}
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {loginMethod === 'OTP' ? (
              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">{t.mobileLabel}</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-10 pr-24 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium bg-white"
                    />
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={isLoading || otpSent}
                      className="absolute right-1.5 top-1.5 px-3 py-1.5 bg-teal-100 hover:bg-teal-200 text-teal-800 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                    >
                      {otpSent ? t.resendOtp : t.sendOtp}
                    </button>
                  </div>
                </div>

                {otpSent && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      {t.enterOtp} ({t.demoOtpText} <span className="text-teal-600 font-mono font-bold">7482</span>)
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
                        className="w-full pl-10 pr-3 py-2.5 text-xs rounded-xl border border-teal-300 bg-teal-50/40 focus:outline-none focus:ring-2 focus:ring-teal-600 font-mono tracking-widest text-center font-bold text-teal-900"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">{t.emailLabel}</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">{t.pwdLabel}</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium bg-white"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <span>{t.testingAccount}</span>
              <button
                type="button"
                onClick={() => {
                  setPhone(roleMeta[selectedRole].demoPhone);
                  setOtp('7482');
                  setOtpSent(true);
                }}
                className="text-teal-700 font-bold hover:underline"
              >
                {t.autoFill}
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading || (loginMethod === 'OTP' && !otpSent)}
              className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 active:scale-[0.99] text-white font-bold text-xs rounded-xl shadow-md shadow-teal-600/25 transition-all uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {isLoading ? (
                t.verifying
              ) : (
                <>
                  {t.accessBtn} {roleMeta[selectedRole].title}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

        </div>

      </div>

    </div>
  );
}