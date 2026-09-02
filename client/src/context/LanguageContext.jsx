import React, { createContext, useContext, useState } from 'react';

const LanguageContext = createContext();

export const translations = {
  en: {
    // Brand & General
    portalSubtitle: 'Rural Healthcare Infrastructure Portal',
    portalTagline: 'Role-Based Clinical Authentication Gateway. Select your operational post below.',
    selectRole: 'SELECT OPERATIONAL ROLE',
    logout: 'Logout',
    online: 'Online',
    offline: 'Offline Mode',

    // Roles
    ashaTab: 'ASHA',
    ashaTitle: 'ASHA Field Worker',
    ashaDesc: 'Offline sync registry, clinical triage & maternal care monitoring',
    doctorTab: 'Doctor',
    doctorTitle: 'Medical Officer (Doctor)',
    doctorDesc: 'Tele-consultation OPD, digital Rx & live emergency triage streams',
    adminTab: 'Admin / CMO',
    adminTitle: 'PHC Admin / CMO Hub',
    adminDesc: 'Real-time PHC logistics, drug stock replenishment & district surveillance',

    // Auth
    otpMode: 'Secure Mobile OTP',
    pwdMode: 'Govt ID & Password',
    mobileLabel: 'Registered Medical Mobile Number',
    sendOtp: 'Send OTP',
    resendOtp: 'Resend',
    enterOtp: 'Enter 4-Digit Clinical Token',
    demoOtpText: 'Demo OTP:',
    emailLabel: 'Official NIC / Healthcare Email',
    pwdLabel: 'Password',
    testingAccount: 'Testing Account:',
    autoFill: 'Auto-fill demo credentials',
    accessBtn: 'Access',
    verifying: 'Verifying Credentials...',

    // ASHA Dashboard
    ashaDeskTitle: 'Frontline Clinical Registry',
    ashaDeskSub: 'Sub-Center Village Hub • Offline First',
    registerCitizenBtn: '+ Register New Citizen',
    searchPlaceholder: 'Search by citizen name, phone or ABHA ID...',
    allSeverity: 'All Severity Levels',
    criticalFilter: 'Critical (Red Triage)',
    moderateFilter: 'Moderate (Yellow Triage)',
    normalFilter: 'Stable (Green)',
    syncStatus: 'Synced with Cloud',
    pendingSync: 'Records Pending Sync',
    btnTriage: 'Clinical Triage',
    btnAbha: 'ABHA QR Card',
    btnTele: 'Tele-Consult',
    maternalBadge: 'High Risk Maternal',
    noCitizensFound: 'No citizen records match the search filter.',

    // Doctor Dashboard
    doctorOPDTitle: 'Medical Officer Tele-Consultation Queue',
    doctorOPDSub: 'District PHC Tele-Hub • Live WebSocket Triage',
    queueLive: 'Live Queue',
    prescribeBtn: 'Digital Rx',
    dispatch108Btn: 'Dispatch 108 FRU',
    noPendingPatients: 'No critical patients waiting in queue.',

    // Admin Dashboard
    adminTitleHeader: 'CMO District Healthcare Surveillance',
    staffRoster: 'Healthcare Personnel Directory',
    drugInventory: 'Essential Drug Supply Chain',
    addStaff: '+ Add Healthcare Staff',
    replenishStock: 'Replenish Drug Inventory'
  },

  hi: {
    // Brand & General
    portalSubtitle: 'ग्रामीण स्वास्थ्य अवसंरचना पोर्टल',
    portalTagline: 'भूमिका-आधारित स्वास्थ्य प्रमाणीकरण गेटवे। अपना पद चुनें।',
    selectRole: 'कार्यकारी पद चुनें',
    logout: 'लॉगआउट',
    online: 'ऑनलाइन',
    offline: 'ऑफलाइन मोड',

    // Roles
    ashaTab: 'आशा (ASHA)',
    ashaTitle: 'आशा स्वास्थ्य कार्यकर्ता',
    ashaDesc: 'ऑफलाइन नागरिक पंजीकरण, क्लिनिकल त्रियाज एवं मातृ देखभाल निगरानी',
    doctorTab: 'चिकित्सक (Doctor)',
    doctorTitle: 'चिकित्सा अधिकारी (Doctor)',
    doctorDesc: 'टेली-परामर्श ओपीडी, डिजिटल पर्ची एवं लाइव आपातकालीन त्रियाज',
    adminTab: 'प्रशासन / CMO',
    adminTitle: 'प्राथमिक स्वास्थ्य केंद्र प्रशासन / CMO',
    adminDesc: 'रीयल-टाइम दवा आपूर्ति प्रबंधन, स्टाफ रोस्टर एवं जिला स्वास्थ्य निगरानी',

    // Auth
    otpMode: 'सुरक्षित मोबाइल OTP',
    pwdMode: 'शासकीय ID एवं पासवर्ड',
    mobileLabel: 'पंजीकृत स्वास्थ्य मोबाइल नंबर',
    sendOtp: 'OTP भेजें',
    resendOtp: 'पुनः भेजें',
    enterOtp: '4-अंकों का क्लिनिकल टोकन दर्ज करें',
    demoOtpText: 'डेमो OTP:',
    emailLabel: 'आधिकारिक NIC / स्वास्थ्य ईमेल',
    pwdLabel: 'पासवर्ड',
    testingAccount: 'परीक्षण खाता:',
    autoFill: 'डेमो विवरण स्वतः भरें',
    accessBtn: 'प्रवेश करें',
    verifying: 'सत्यापन हो रहा है...',

    // ASHA Dashboard
    ashaDeskTitle: 'आशा फ्रंटलाइन नागरिक स्वास्थ्य पंजी',
    ashaDeskSub: 'उप-स्वास्थ्य केंद्र ग्रामीण हब • ऑफलाइन सक्रिय',
    registerCitizenBtn: '+ नया नागरिक पंजीकृत करें',
    searchPlaceholder: 'नागरिक का नाम, फोन या आभा ID खोजें...',
    allSeverity: 'सभी स्वास्थ्य श्रेणियां',
    criticalFilter: 'अति-गंभीर (लाल त्रियाज)',
    moderateFilter: 'मध्यम जोखिम (पीला त्रियाज)',
    normalFilter: 'सामान्य (हरा)',
    syncStatus: 'क्लाउड से सुरक्षित सिंक',
    pendingSync: 'रिकॉर्ड सिंक होना बाकी',
    btnTriage: 'क्लिनिकल त्रियाज',
    btnAbha: 'आभा QR कार्ड',
    btnTele: 'टेली-परामर्श',
    maternalBadge: 'उच्च जोखिम मातृ देखभाल',
    noCitizensFound: 'इस खोज फिल्टर में कोई नागरिक रिकॉर्ड नहीं मिला।',

    // Doctor Dashboard
    doctorOPDTitle: 'चिकित्सा अधिकारी टेली-परामर्श ओपीडी कतार',
    doctorOPDSub: 'जिला प्राथमिक स्वास्थ्य केंद्र • लाइव सॉकेट त्रियाज',
    queueLive: 'लाइव मरीज कतार',
    prescribeBtn: 'डिजिटल पर्ची',
    dispatch108Btn: '108 एम्बुलेंस भेजें',
    noPendingPatients: 'अभी कोई मरीज प्रतीक्षा सूची में नहीं है।',

    // Admin Dashboard
    adminTitleHeader: 'मुख्य चिकित्सा अधिकारी (CMO) जिला निगरानी',
    staffRoster: 'स्वास्थ्य कर्मचारी निर्देशिका',
    drugInventory: 'आवश्यक दवा आपूर्ति श्रृंखला',
    addStaff: '+ नया स्टाफ जोड़ें',
    replenishStock: 'दवा स्टॉक की पुनः आपूर्ति'
  }
};

export const LanguageProvider = ({ children }) => {
  const [lang, setLang] = useState(() => localStorage.getItem('swasthya_lang') || 'en');

  const toggleLanguage = (selectedLang) => {
    const newLang = selectedLang || (lang === 'en' ? 'hi' : 'en');
    setLang(newLang);
    localStorage.setItem('swasthya_lang', newLang);
  };

  const t = translations[lang] || translations.en;

  return (
    <LanguageContext.Provider value={{ lang, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);